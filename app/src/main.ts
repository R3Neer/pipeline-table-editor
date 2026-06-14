import "./styles.css";

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
import { createDefaultState } from "./core/state";
import {
  applyInstructionText,
  changeCycleCount,
  pruneArrowsFromStruckCells as pruneStruckCellArrows,
  wouldLoseCellsAfterCycleReduction
} from "./core/useCases/tableEditing";
import type { ExportFormat } from "./export/types";
import { loadStateFromStorage } from "./integration/storage";
import { createAutocompleteController } from "./ui/autocomplete";
import { renderAssemblyHighlight } from "./ui/assemblyHighlight";
import { getCellClassName } from "./ui/cellClasses";
import { getAppElements, getInputPosition } from "./ui/dom";
import { createSplitTableController } from "./ui/splitTable";

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

const minInstructionColumnWidth = 320;
const maxInstructionColumnWidth = 520;

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
  updateInstructionColumnWidth();
  splitTable.syncLayout();
  window.requestAnimationFrame(() => {
    splitTable.syncLayout();
    drawArrows();
  });
}

function makeHeader(text: string, className: string): HTMLTableCellElement {
  const th = document.createElement("th");
  th.className = className;
  th.textContent = text;
  return th;
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
    updateInstructionColumnWidth();
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

function makeRowButton(text: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `row-btn${extraClass ? ` ${extraClass}` : ""}`;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function updateInstructionColumnWidth(): void {
  const longestText = Math.max(
    0,
    ...[...elements.instructionMount.querySelectorAll<HTMLElement>(".instruction-main")].map((item) => item.scrollWidth)
  );
  const buttonAreaWidth = 3 * 34 + 2 * 7 + 12 + 20;
  const nextWidth = Math.min(maxInstructionColumnWidth, Math.max(minInstructionColumnWidth, longestText + buttonAreaWidth));
  elements.tableShell.style.setProperty("--instruction-col-width", `${Math.ceil(nextWidth)}px`);
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

function makeInstructionScrollbarSpacer(): HTMLElement {
  const spacer = document.createElement("div");
  spacer.className = "instruction-scrollbar-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
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

function applyInstructions(): void {
  applyInstructionText(state, elements.instructionsInput.value);
  selection.setSelectedCell(null);
  clearSelection();
  clearRowSelection();
  cancelArrowDraft();
  arrowsAndExpansion.cancelExpandDraft();
  render();
  scheduleSave();
}

async function changeCycles(): Promise<void> {
  const nextCycles = Math.max(1, Number.parseInt(elements.cyclesInput.value, 10) || 1);
  if (nextCycles === state.cycles) return;
  if (nextCycles < state.cycles && wouldLoseCellsAfterCycleReduction(state, nextCycles)) {
    const ok = await showConfirm("Reduce cycles", "Reducing cycles will delete content. Continue?", "Reduce");
    if (!ok) {
      elements.cyclesInput.value = String(state.cycles);
      return;
    }
  }
  changeCycleCount(state, nextCycles);
  render();
  scheduleSave();
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

async function clearAll(): Promise<void> {
  if (!(await showConfirm("Clear table", "Clear the whole table?", "Clear"))) return;
  state = createDefaultState();
  selection.setSelectedCell(null);
  clearSelection();
  cancelArrowDraft();
  arrowsAndExpansion.cancelExpandDraft();
  render();
  saveState(true);
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

elements.titleInput.addEventListener("input", () => {
  state.title = elements.titleInput.value;
  scheduleSave();
});
elements.cyclesInput.addEventListener("change", () => {
  void changeCycles();
});
elements.instructionsInput.addEventListener("input", applyInstructions);
elements.exportMenuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  exportImport.toggleExportMenu();
});
elements.exportMenu.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-export-format]") : null;
  if (!button) return;
  exportImport.hideExportMenu();
  void exportImport.showExport(button.dataset.exportFormat as ExportFormat);
});
elements.copyExportBtn.addEventListener("click", exportImport.copyExport);
elements.downloadExportBtn.addEventListener("click", exportImport.downloadTextExport);
elements.importBtn.addEventListener("click", () => {
  void exportImport.importJson();
});
elements.clearBtn.addEventListener("click", () => {
  void clearAll();
});
elements.collapseSidebarBtn.addEventListener("click", () => {
  elements.layoutRoot.classList.add("sidebar-collapsed");
  window.requestAnimationFrame(drawArrows);
});
elements.expandSidebarBtn.addEventListener("click", () => {
  elements.layoutRoot.classList.remove("sidebar-collapsed");
  window.requestAnimationFrame(drawArrows);
});
elements.closeExportBtn.addEventListener("click", exportImport.hideExport);
elements.exportModal.addEventListener("click", (event) => {
  if (event.target === elements.exportModal) exportImport.hideExport();
});
labelModal.bindEvents();
elements.acceptConfirmBtn.addEventListener("click", () => closeConfirmModal(true));
elements.cancelConfirmBtn.addEventListener("click", () => closeConfirmModal(false));
elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) closeConfirmModal(false);
});
contextMenu.bindEvents();
elements.autocompleteMenu.addEventListener("autocomplete:accept", (event) => {
  cellEditing.acceptSuggestion((event as CustomEvent<string>).detail);
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !elements.cellMenu.contains(event.target)) contextMenu.hideCellMenu();
  if (event.target instanceof Node && !elements.rowMenu.contains(event.target)) contextMenu.hideRowMenu();
  if (event.target instanceof Node && !elements.exportMenu.contains(event.target) && event.target !== elements.exportMenuBtn) {
    exportImport.hideExportMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Alt" || event.key === "Control" || event.key === "Meta" || event.key === "Shift") {
    autocomplete.hide();
  }
  if (event.key === "Escape") cancelTransientUi();
});
window.addEventListener("resize", () => {
  splitTable.syncLayout();
  drawArrows();
});

function attachTextareaResizeHandles(): void {
  document.querySelectorAll<HTMLElement>(".textarea-resize-handle").forEach((handle) => {
    const textarea = handle.previousElementSibling;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    let drag: { startY: number; startHeight: number } | null = null;
    handle.addEventListener("pointerdown", (event) => {
      drag = { startY: event.clientY, startHeight: textarea.getBoundingClientRect().height };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      textarea.style.height = `${Math.max(80, drag.startHeight + event.clientY - drag.startY)}px`;
    });
    handle.addEventListener("pointerup", () => {
      drag = null;
    });
    handle.addEventListener("pointercancel", () => {
      drag = null;
    });
  });
}

function getAllLabels(): string[] {
  return getKnownLabels(state.rows.map((row) => row.label));
}

attachTextareaResizeHandles();
splitTable.attach();
pruneArrowsFromStruckCells();
render();
saveState(false);
