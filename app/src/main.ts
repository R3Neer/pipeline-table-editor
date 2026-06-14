import "./styles.css";

import { bindAppEvents } from "./app/appEventBindings";
import { getKnownLabels, getLabelColor } from "./core/labels";
import type { AppState, CellPosition } from "./core/model";
import { createArrowAndExpansionController } from "./app/arrowAndExpansionController";
import { createCellEditingController } from "./app/cellEditingController";
import { createContextMenuController } from "./app/contextMenuController";
import { createExportImportController } from "./app/exportImportController";
import { createLabelModalController } from "./app/labelModalController";
import { createModalController } from "./app/modalController";
import { createPersistenceController } from "./app/persistenceController";
import { createRowEditingController } from "./app/rowEditingController";
import { createSelectionController } from "./app/selectionController";
import { createTableWorkflowController } from "./app/tableWorkflowController";
import { createDefaultState } from "./core/state";
import { pruneArrowsFromStruckCells as pruneStruckCellArrows } from "./core/useCases/tableEditing";
import { loadStateFromStorage } from "./integration/storage";
import { createAutocompleteController } from "./ui/autocomplete";
import { renderAssemblyHighlight } from "./ui/assemblyHighlight";
import { getCellClassName } from "./ui/cellClasses";
import { getAppElements, getInputPosition } from "./ui/dom";
import { updateInstructionColumnWidth } from "./ui/instructionColumnWidth";
import { createSplitTableController } from "./ui/splitTable";
import { makeHeader, makeInstructionScrollbarSpacer, makeRowButton } from "./ui/tableElements";

const elements = getAppElements();
const autocomplete = createAutocompleteController(elements.autocompleteMenu);
const selection = createSelectionController();
const splitTable = createSplitTableController(elements, () => drawArrows());

let state: AppState = loadStateFromStorage() || createDefaultState();

const { showConfirm, showNotice, closeConfirmModal } = createModalController(elements);
const { scheduleSave, saveState } = createPersistenceController({
  elements,
  getState: () => state,
  showStatus
});
const labelModal = createLabelModalController({
  elements,
  getState: () => state,
  render,
  scheduleSave
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
    render,
    scheduleSave,
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
  render,
  scheduleSave,
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
  clearRowSelection,
  setSingleSelection,
  updateSelectionFromClick,
  renderSelectionInfo,
  cancelTransientUi,
  refreshCellClasses,
  scheduleSave,
  drawArrows,
  removeOutgoingArrows
});
const tableWorkflow = createTableWorkflowController({
  elements,
  getState: () => state,
  setState,
  render,
  scheduleSave,
  saveState,
  showConfirm,
  resetTransientState,
  clearSelections
});
contextMenu = createContextMenuController({
  elements,
  selection,
  getState: () => state,
  isMultiSelection,
  canStartExpand,
  actions: {
    startArrow,
    removeArrowsFrom,
    toggleStrike: cellEditing.toggleStrike,
    startExpand,
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
  const instructionTable = document.createElement("table");
  instructionTable.className = "pipeline-table instruction-table";

  const instructionHead = document.createElement("thead");
  const instructionHeadRow = document.createElement("tr");
  instructionHeadRow.appendChild(makeHeader("Instruction", "instruction-col"));
  instructionHead.appendChild(instructionHeadRow);
  instructionTable.appendChild(instructionHead);

  const instructionBody = document.createElement("tbody");
  instructionTable.appendChild(instructionBody);

  const cycleTable = document.createElement("table");
  cycleTable.className = "pipeline-table cycle-table";

  const cycleHead = document.createElement("thead");
  const cycleHeadRow = document.createElement("tr");
  for (let cycle = 1; cycle <= state.cycles; cycle += 1) {
    cycleHeadRow.appendChild(makeHeader(String(cycle), "cycle-col"));
  }
  cycleHead.appendChild(cycleHeadRow);
  cycleTable.appendChild(cycleHead);

  const cycleBody = document.createElement("tbody");
  state.rows.forEach((row, rowIndex) => {
    const instructionTr = document.createElement("tr");
    if (row.separatorBefore) instructionTr.classList.add("row-separator");
    const instructionTd = document.createElement("td");
    instructionTd.className = "instruction-col";
    instructionTd.appendChild(makeInstructionEditor(rowIndex));
    instructionTr.appendChild(instructionTd);
    instructionBody.appendChild(instructionTr);

    const cycleTr = document.createElement("tr");
    if (row.separatorBefore) cycleTr.classList.add("row-separator");
    row.cells.forEach((cell, cycleIndex) => {
      const td = document.createElement("td");
      td.className = "cycle-col";
      const input = document.createElement("input");
      input.className = getCellClassForPosition(rowIndex, cycleIndex);
      input.value = cell.text;
      input.dataset.row = String(rowIndex);
      input.dataset.cycle = String(cycleIndex);
      input.autocomplete = "off";
      input.spellcheck = false;
      input.addEventListener("input", cellEditing.onCellInput);
      input.addEventListener("focus", cellEditing.onCellFocus);
      input.addEventListener("keydown", cellEditing.onCellKeyDown);
      input.addEventListener("click", cellEditing.onCellClick);
      input.addEventListener("mouseenter", cellEditing.onCellMouseEnter);
      input.addEventListener("mouseleave", cellEditing.onCellMouseLeave);
      input.addEventListener("contextmenu", cellEditing.onCellContextMenu);
      input.addEventListener("blur", () => window.setTimeout(cellEditing.hideAutocompleteIfFocusLeftCells, 120));
      td.appendChild(input);
      cycleTr.appendChild(td);
    });

    cycleBody.appendChild(cycleTr);
  });

  cycleTable.appendChild(cycleBody);
  elements.instructionMount.replaceChildren(
    instructionTable,
    makeInstructionScrollbarSpacer(),
    makeAddRowZone()
  );
  elements.tableMount.replaceChildren(cycleTable);
  updateInstructionColumnWidth(elements);
  splitTable.syncLayout();
  window.requestAnimationFrame(() => {
    splitTable.syncLayout();
    drawArrows();
  });
}

function makeInstructionEditor(rowIndex: number): HTMLElement {
  const row = state.rows[rowIndex];
  const wrapper = document.createElement("div");
  wrapper.className = `instruction-cell${selection.hasSelectedRow(rowIndex) ? " row-selected" : ""}`;
  wrapper.dataset.row = String(rowIndex);
  wrapper.addEventListener("click", onInstructionClick);
  wrapper.addEventListener("contextmenu", onInstructionContextMenu);

  const main = document.createElement("div");
  main.className = "instruction-main";

  if (row.label) {
    const label = document.createElement("span");
    label.className = "row-label";
    label.style.color = getLabelColor(row.label);
    label.textContent = `${row.label}:`;
    main.appendChild(label);
  }

  const editor = document.createElement("div");
  editor.className = "assembly-editor";
  const highlight = document.createElement("div");
  highlight.className = "assembly-highlight";
  highlight.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.className = "assembly-input";
  input.dataset.row = String(rowIndex);
  input.value = row.instruction;
  input.spellcheck = false;
  syncAssemblyHighlight(input, highlight);
  input.addEventListener("input", () => {
    state.rows[rowIndex].instruction = input.value;
    elements.instructionsInput.value = state.rows.map((item) => item.instruction).join("\n");
    syncAssemblyHighlight(input, highlight);
    updateInstructionColumnWidth(elements);
    splitTable.syncLayout();
    scheduleSave();
    window.requestAnimationFrame(drawArrows);
  });
  input.addEventListener("focus", clearCellSelection);
  input.addEventListener("scroll", () => {
    highlight.scrollLeft = input.scrollLeft;
  });

  editor.append(highlight, input);
  main.appendChild(editor);
  wrapper.append(
    main,
    makeRowButton("↑", () => rowEditing.moveRowsFrom(rowIndex, -1)),
    makeRowButton("↓", () => rowEditing.moveRowsFrom(rowIndex, 1)),
    makeRowButton("×", () => rowEditing.removeRowsFrom(rowIndex), "row-delete-button")
  );
  return wrapper;
}

function syncAssemblyHighlight(input: HTMLInputElement, highlight: HTMLElement): void {
  const isAnnotation = renderAssemblyHighlight(highlight, input.value, getAllLabels());
  input.classList.toggle("assembly-input-annotation", isAnnotation);
}

function makeAddRowZone(): HTMLElement {
  const zone = document.createElement("div");
  zone.className = "add-row-zone";
  const button = document.createElement("button");
  button.id = "addRowInlineBtn";
  button.className = "add-row-button";
  button.type = "button";
  button.textContent = "+";
  button.title = "Add row";
  button.setAttribute("aria-label", "Add row");
  button.addEventListener("click", rowEditing.addInstruction);
  zone.appendChild(button);
  return zone;
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
  document.querySelectorAll<HTMLInputElement>(".stage-input").forEach((input) => {
    const pos = getInputPosition(input);
    const cell = state.rows[pos.row].cells[pos.cycle];
    input.className = getCellClassForPosition(pos.row, pos.cycle);
  });
}

function updateSelectionFromClick(pos: CellPosition, event: MouseEvent): void {
  selection.updateSelectionFromClick(pos, event);
}

function setSingleSelection(pos: CellPosition): void {
  selection.setSingleSelection(pos);
  refreshRowSelectionClasses();
}

function clearSelection(): void {
  selection.clearSelection();
}

function clearRowSelection(): void {
  selection.clearRowSelection();
  refreshRowSelectionClasses();
}

function clearCellSelection(): void {
  selection.clearCellSelection();
  refreshCellClasses();
}

function setSingleRowSelection(rowIndex: number): void {
  selection.setSingleRowSelection(rowIndex);
  refreshCellClasses();
  refreshRowSelectionClasses();
}

function updateRowSelectionFromClick(rowIndex: number, event: MouseEvent): void {
  selection.updateRowSelectionFromClick(rowIndex, event);
  refreshCellClasses();
  refreshRowSelectionClasses();
}

function refreshRowSelectionClasses(): void {
  document.querySelectorAll<HTMLElement>(".instruction-cell").forEach((rowElement) => {
    const rowIndex = Number(rowElement.dataset.row);
    rowElement.classList.toggle("row-selected", selection.hasSelectedRow(rowIndex));
  });
}

function getSelectedPositions(): CellPosition[] {
  return selection.getSelectedPositions(state);
}

function isMultiSelection(): boolean {
  return selection.isMultiSelection();
}

function onInstructionClick(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Element && target.closest("button")) return;
  const rowElement = event.currentTarget as HTMLElement;
  updateRowSelectionFromClick(Number(rowElement.dataset.row), event);
}

function onInstructionContextMenu(event: MouseEvent): void {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement;
  const contextRow = Number(target.dataset.row);
  if (!selection.hasSelectedRow(contextRow)) setSingleRowSelection(contextRow);
  contextMenu.hideCellMenu();
  autocomplete.hide();
  contextMenu.openRowMenu(contextRow, event.clientX, event.clientY);
}

function startArrow(pos: CellPosition): void {
  arrowsAndExpansion.startArrow(pos);
}

function startExpand(pos: CellPosition): void {
  arrowsAndExpansion.startExpand(pos);
}

function removeArrowsFrom(pos: CellPosition): void {
  arrowsAndExpansion.removeArrowsFrom(pos);
}

function cancelArrowDraft(): void {
  arrowsAndExpansion.cancelArrowDraft();
}

function canStartExpand(pos: CellPosition): boolean {
  return arrowsAndExpansion.canStartExpand(pos);
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
  clearSelection();
  clearRowSelection();
}

function removeOutgoingArrows(pos: CellPosition): boolean {
  return arrowsAndExpansion.removeOutgoingArrows(pos);
}

function pruneArrowsFromStruckCells(): boolean {
  return pruneStruckCellArrows(state);
}

function resetAfterStateImport(): void {
  pruneArrowsFromStruckCells();
  selection.setSelectedCell(null);
  clearSelection();
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

function getAllLabels(): string[] {
  return getKnownLabels(state.rows.map((row) => row.label));
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
