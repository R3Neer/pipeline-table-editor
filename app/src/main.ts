import "./styles.css";

import { createAppMutationEffects } from "./app/appEffects";
import { bindAppEvents } from "./app/events/appEventBindings";
import type { AppState, CellPosition } from "./core/model";
import { createArrowAndExpansionController } from "./app/modes/arrowAndExpansionController";
import { createCellEditingController } from "./app/cells/cellEditingController";
import { createContextMenuController } from "./app/menus/contextMenuController";
import { createExportImportController } from "./app/workflows/exportImportController";
import { createLabelModalController } from "./app/modals/labelModalController";
import { createModalController } from "./app/modals/modalController";
import { createPersistenceController } from "./app/persistence/persistenceController";
import { createRowEditingController } from "./app/rows/rowEditingController";
import { createSelectionController } from "./app/selection/selectionController";
import { createSelectionUiController } from "./app/selection/selectionUiController";
import { createTableRenderer } from "./app/rendering/tableRenderer";
import { createTableWorkflowController } from "./app/workflows/tableWorkflowController";
import { createDefaultState } from "./core/state";
import { pruneArrowsFromStruckCells as pruneStruckCellArrows } from "./core/useCases/tableEditing";
import { loadStateFromStorage } from "./integration/storage";
import { createAutocompleteController } from "./ui/autocomplete";
import { getCellClassName } from "./ui/cellClasses";
import { getAppElements, getInputPosition } from "./ui/dom";
import { createSplitTableController } from "./ui/splitTable";

const elements = getAppElements();
const autocomplete = createAutocompleteController(elements.autocompleteMenu);
const selection = createSelectionController();
const splitTable = createSplitTableController(elements, () => drawArrows());
const selectionUi = createSelectionUiController({
  selection,
  getState: () => state,
  refreshCellClasses,
  refreshRowSelectionClasses
});

let state: AppState = loadStateFromStorage() || createDefaultState();

const { showConfirm, showNotice, closeConfirmModal } = createModalController(elements);
const { scheduleSave, saveState } = createPersistenceController({
  elements,
  getState: () => state,
  showStatus
});
const effects = createAppMutationEffects({
  render,
  refreshCellClasses,
  scheduleSave,
  drawArrows
});
const labelModal = createLabelModalController({
  elements,
  getState: () => state,
  effects
});
const exportImport = createExportImportController(
  {
    elements,
    getState: () => state,
    setState,
    render,
    saveState,
    showStatus,
    showNotice
  },
  {
    onStateImported: resetAfterStateImport
  }
);
const arrowsAndExpansion = createArrowAndExpansionController(
  {
    elements,
    getState: () => state,
    effects,
    showStatus,
    showConfirm
  },
  {
    getCellElement,
    hideAutocomplete: autocomplete.hide,
    refreshCellClasses,
    renderSelectionInfo
  }
);
const rowEditing = createRowEditingController({
  elements,
  selection,
  getState: () => state,
  effects,
  showConfirm
});
let contextMenu: ReturnType<typeof createContextMenuController>;
const cellEditing = createCellEditingController({
  selection,
  getState: () => state,
  getCellElement,
  autocomplete,
  arrowExpansion: arrowsAndExpansion,
  contextMenu: {
    hideCellMenu: () => contextMenu.hideCellMenu(),
    openCellMenu: (pos, x, y) => contextMenu.openCellMenu(pos, x, y)
  },
  clearRowSelection: selectionUi.clearRowSelection,
  setSingleSelection: selectionUi.setSingleSelection,
  updateSelectionFromClick: selectionUi.updateSelectionFromClick,
  renderSelectionInfo,
  cancelTransientUi,
  effects,
  removeOutgoingArrows: arrowsAndExpansion.removeOutgoingArrows
});
const tableWorkflow = createTableWorkflowController({
  elements,
  getState: () => state,
  setState,
  render,
  effects,
  saveState,
  showConfirm,
  resetTransientState,
  clearSelections
});
contextMenu = createContextMenuController({
  elements,
  selection,
  getState: () => state,
  isMultiSelection: selectionUi.isMultiSelection,
  canStartExpand: arrowsAndExpansion.canStartExpand,
  actions: {
    startArrow: arrowsAndExpansion.startArrow,
    removeArrowsFrom: arrowsAndExpansion.removeArrowsFrom,
    toggleStrike: cellEditing.toggleStrike,
    startExpand: arrowsAndExpansion.startExpand,
    copyCell: cellEditing.copyCell,
    cutCell: cellEditing.cutCell,
    pasteCell: cellEditing.pasteCell,
    clearCell: cellEditing.clearCell,
    editRowLabel: labelModal.open,
    removeRowLabel: rowEditing.removeRowLabel,
    toggleRowSeparator: rowEditing.toggleRowSeparator,
    copyInstruction: rowEditing.copyInstruction,
    cutInstruction: rowEditing.cutInstruction,
    pasteInstruction: rowEditing.pasteInstruction,
    clearInstruction: rowEditing.clearInstruction
  }
});
const tableRenderer = createTableRenderer({
  elements,
  splitTable,
  selection,
  cellEditing,
  rowEditing,
  getState: () => state,
  getCellClassForPosition,
  clearCellSelection: selectionUi.clearCellSelection,
  scheduleSave,
  drawArrows,
  onInstructionClick,
  onInstructionContextMenu
});

function setState(nextState: AppState): void {
  state = nextState;
}

function render(): void {
  elements.titleInput.value = state.title;
  elements.cyclesInput.value = String(state.cycles);
  elements.instructionsInput.value = state.rows.map((row) => row.instruction).join("\n");
  renderTable();
  renderSelectionInfo();
  window.requestAnimationFrame(drawArrows);
}

function renderTable(): void {
  tableRenderer.renderTable();
}

function getCellClassForPosition(row: number, cycle: number): string {
  return getCellClassName(state, { row, cycle }, {
    selectedCell: selection.getSelectedCell(),
    selectedCellKeys: selection.getSelectedCellKeys(),
    arrowFrom: arrowsAndExpansion.getArrowFrom(),
    arrowHoverTarget: arrowsAndExpansion.getArrowHoverTarget(),
    expandFrom: arrowsAndExpansion.getExpandFrom()
  });
}

function refreshCellClasses(): void {
  tableRenderer.refreshCellClasses();
}

function refreshRowSelectionClasses(): void {
  tableRenderer.refreshRowSelectionClasses();
}

function onInstructionClick(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Element && target.closest("button")) return;
  const rowElement = event.currentTarget as HTMLElement;
  selectionUi.updateRowSelectionFromClick(Number(rowElement.dataset.row), event);
}

function onInstructionContextMenu(event: MouseEvent): void {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement;
  const contextRow = Number(target.dataset.row);
  if (!selection.hasSelectedRow(contextRow)) selectionUi.setSingleRowSelection(contextRow);
  contextMenu.hideCellMenu();
  autocomplete.hide();
  contextMenu.openRowMenu(contextRow, event.clientX, event.clientY);
}

function cancelArrowDraft(): void {
  arrowsAndExpansion.cancelArrowDraft();
}

function drawArrows(): void {
  arrowsAndExpansion.drawArrows();
}

function getCellElement(pos: CellPosition): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(`.stage-input[data-row="${pos.row}"][data-cycle="${pos.cycle}"]`);
}

function renderSelectionInfo(): void {
  refreshCellClasses();
}

function resetTransientState(): void {
  selection.setSelectedCell(null);
  cancelArrowDraft();
  arrowsAndExpansion.cancelExpandDraft();
}

function clearSelections(): void {
  selectionUi.clearSelection();
  selectionUi.clearRowSelection();
}

function pruneArrowsFromStruckCells(): boolean {
  return pruneStruckCellArrows(state);
}

function resetAfterStateImport(): void {
  pruneArrowsFromStruckCells();
  selection.setSelectedCell(null);
  selectionUi.clearSelection();
  cancelArrowDraft();
  arrowsAndExpansion.cancelExpandDraft();
}

function showStatus(message: string): void {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("is-visible", Boolean(message));
}

function cancelTransientUi(): void {
  cancelArrowDraft();
  arrowsAndExpansion.cancelExpandDraft();
  contextMenu.hideAll();
  autocomplete.hide();
  exportImport.hideExport();
  labelModal.hide();
  closeConfirmModal(false);
  refreshCellClasses();
  renderSelectionInfo();
}

bindAppEvents({
  elements,
  splitTable,
  tableWorkflow,
  exportImport,
  labelModal,
  contextMenu,
  cellEditing,
  setTitle: (title) => {
    state.title = title;
  },
  scheduleSave,
  drawArrows,
  closeConfirmModal,
  hideAutocomplete: autocomplete.hide,
  cancelTransientUi
});
splitTable.attach();
pruneArrowsFromStruckCells();
render();
saveState(false);

