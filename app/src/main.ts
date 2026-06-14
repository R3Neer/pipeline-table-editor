import "./styles.css";

import { isValidArrowTarget, samePos } from "./core/arrows";
import { canStartExpand as canStartExpandStage, makeExpansionValues, wouldChangeFilledCells } from "./core/expansion";
import { getKnownLabels, getLabelColor, normalizeRowLabel } from "./core/labels";
import type {
  AppState,
  ArrowDraft,
  CellPosition,
  ContextAction,
  CopiedCell,
  ExpandDraft,
  ExportFormat,
  RowContextAction
} from "./core/model";
import { makeRectangularSelection, makeVerticalSelection, parsePositionKey, positionKey } from "./core/selection";
import {
  getRowActionTargets as getSelectedRowTargets,
  isRowNonEmpty as isInstructionRowNonEmpty,
  moveRows,
  removeRows
} from "./core/rows";
import { createDefaultState, loadState, makeRow, normalizeState, saveStateToStorage } from "./core/state";
import { getValidRoot, isCellTextValid, normalizeCellText } from "./core/validation";
import { exportJson, exportMarkdown, exportPng, exportText } from "./export/index";
import { drawArrows as drawArrowLayer } from "./ui/arrows";
import { createAutocompleteController } from "./ui/autocomplete";
import { getAppElements, getInputPosition, renderAssemblyHighlight } from "./ui/dom";
import { downloadBlob, makeDownloadSlug } from "./ui/download";
import { placeFloatingElement, placeSubmenu } from "./ui/positioning";
import { createSplitTableController } from "./ui/splitTable";

const elements = getAppElements();
const autocomplete = createAutocompleteController(elements.autocompleteMenu);
const splitTable = createSplitTableController(elements, () => drawArrows());

let state: AppState = loadState() || createDefaultState();
let selectedCell: CellPosition | null = null;
let selectionAnchor: CellPosition | null = null;
let selectedCellKeys = new Set<string>();
let selectedRows = new Set<number>();
let rowSelectionAnchor: number | null = null;
let contextCell: CellPosition | null = null;
let contextRow: number | null = null;
let labelEditRow: number | null = null;
let copiedCell: CopiedCell | null = null;
let copiedInstruction: string | null = null;
let arrowDraft: ArrowDraft = { from: null };
let arrowHoverTarget: CellPosition | null = null;
let expandDraft: ExpandDraft = { from: null };
let saveTimer = 0;

const minInstructionColumnWidth = 320;
const maxInstructionColumnWidth = 520;

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
      input.className = getCellClassForPosition(cell.text, cell.struck, rowIndex, cycleIndex);
      input.value = cell.text;
      input.dataset.row = String(rowIndex);
      input.dataset.cycle = String(cycleIndex);
      input.autocomplete = "off";
      input.spellcheck = false;
      input.addEventListener("input", onCellInput);
      input.addEventListener("focus", onCellFocus);
      input.addEventListener("keydown", onCellKeyDown);
      input.addEventListener("click", onCellClick);
      input.addEventListener("mouseenter", onCellMouseEnter);
      input.addEventListener("mouseleave", onCellMouseLeave);
      input.addEventListener("contextmenu", onCellContextMenu);
      input.addEventListener("blur", () => window.setTimeout(hideAutocompleteIfFocusLeftCells, 120));
      td.appendChild(input);
      cycleTr.appendChild(td);
    });

    cycleBody.appendChild(cycleTr);
  });

  cycleTable.appendChild(cycleBody);
  elements.instructionMount.replaceChildren(
    instructionTable,
    makeAddRowZone(),
    makeInstructionScrollbarSpacer(),
    makeTableBottomSpacer()
  );
  elements.tableMount.replaceChildren(cycleTable, makeCycleAddRowSpacer(), makeTableBottomSpacer());
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
  wrapper.className = `instruction-cell${selectedRows.has(rowIndex) ? " row-selected" : ""}`;
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
    makeRowButton("↑", () => moveRowsFrom(rowIndex, -1)),
    makeRowButton("↓", () => moveRowsFrom(rowIndex, 1)),
    makeRowButton("×", () => removeRowsFrom(rowIndex), "row-delete-button")
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
  button.addEventListener("click", addInstruction);
  zone.appendChild(button);
  return zone;
}

function makeTableBottomSpacer(): HTMLElement {
  const spacer = document.createElement("div");
  spacer.className = "table-bottom-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function makeCycleAddRowSpacer(): HTMLElement {
  const spacer = document.createElement("div");
  spacer.className = "cycle-add-row-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function makeInstructionScrollbarSpacer(): HTMLElement {
  const spacer = document.createElement("div");
  spacer.className = "instruction-scrollbar-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function getCellClassForPosition(text: string, struck: boolean, row: number, cycle: number): string {
  const classes = ["stage-input"];
  const value = text.trim();
  const root = getValidRoot(value);

  if (value && !isCellTextValid(value, state, { row, cycle })) {
    classes.push("stage-invalid");
  } else if (root) {
    classes.push(`stage-${root.toLowerCase()}`);
    if (value.endsWith("p")) classes.push("stage-p");
  }

  if (struck) classes.push("stage-struck");
  if (selectedCell && selectedCell.row === row && selectedCell.cycle === cycle) classes.push("selected");
  if (isMultiSelection() && selectedCellKeys.has(positionKey({ row, cycle }))) classes.push("multi-selected");
  if (arrowDraft.from && arrowDraft.from.row === row && arrowDraft.from.cycle === cycle) {
    classes.push("arrow-from");
  }
  if (
    arrowDraft.from &&
    arrowHoverTarget &&
    arrowHoverTarget.row === row &&
    arrowHoverTarget.cycle === cycle &&
    isValidArrowTarget(arrowDraft.from, arrowHoverTarget, state)
  ) {
    classes.push("arrow-target-valid");
  }
  if (expandDraft.from && expandDraft.from.row === row && expandDraft.from.cycle === cycle) {
    classes.push("expand-from");
  }
  return classes.join(" ");
}

function refreshCellClasses(): void {
  document.querySelectorAll<HTMLInputElement>(".stage-input").forEach((input) => {
    const pos = getInputPosition(input);
    const cell = state.rows[pos.row].cells[pos.cycle];
    input.className = getCellClassForPosition(cell.text, cell.struck, pos.row, pos.cycle);
  });
}

function onCellInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const pos = getInputPosition(input);
  const normalized = normalizeCellText(input.value);
  state.rows[pos.row].cells[pos.cycle].text = normalized;
  if (input.value !== normalized) input.value = normalized;
  refreshCellClasses();
  autocomplete.show(input, pos, state);
  scheduleSave();
  window.requestAnimationFrame(drawArrows);
}

function onCellFocus(event: FocusEvent): void {
  const input = event.currentTarget as HTMLInputElement;
  clearRowSelection();
  selectedCell = getInputPosition(input);
  if (!selectionAnchor) setSingleSelection(selectedCell);
  hideContextMenu();
  refreshCellClasses();
  renderSelectionInfo();
  autocomplete.show(input, selectedCell, state);
}

function onCellClick(event: MouseEvent): void {
  const input = event.currentTarget as HTMLInputElement;
  clearRowSelection();
  selectedCell = getInputPosition(input);
  hideContextMenu();
  if (expandDraft.from && !samePos(expandDraft.from, selectedCell)) {
    tryExpandTo(selectedCell);
    return;
  }
  if (arrowDraft.from) {
    tryCreateArrowTo(selectedCell);
    return;
  }
  updateSelectionFromClick(selectedCell, event);
  renderSelectionInfo();
  if (isSelectionModifierClick(event)) {
    autocomplete.hide();
    return;
  }
  autocomplete.show(input, selectedCell, state);
}

function onCellMouseEnter(event: MouseEvent): void {
  if (!arrowDraft.from) return;
  arrowHoverTarget = getInputPosition(event.currentTarget as HTMLInputElement);
  refreshCellClasses();
}

function onCellMouseLeave(event: MouseEvent): void {
  if (!arrowHoverTarget) return;
  const pos = getInputPosition(event.currentTarget as HTMLInputElement);
  if (samePos(arrowHoverTarget, pos)) {
    arrowHoverTarget = null;
    refreshCellClasses();
  }
}

function onCellContextMenu(event: MouseEvent): void {
  event.preventDefault();
  const input = event.currentTarget as HTMLInputElement;
  clearRowSelection();
  contextCell = getInputPosition(input);
  selectedCell = { ...contextCell };
  if (!selectedCellKeys.has(positionKey(contextCell))) setSingleSelection(contextCell);
  refreshCellClasses();
  autocomplete.hide();
  showContextMenu(event.clientX, event.clientY);
}

function onCellKeyDown(event: KeyboardEvent): void {
  const input = event.currentTarget as HTMLInputElement;
  const pos = getInputPosition(input);
  const activeSuggestion = autocomplete.active;

  if ((event.key === "ArrowUp" || event.key === "ArrowDown") && activeSuggestion.values.length) {
    event.preventDefault();
    autocomplete.move(event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "Enter" && activeSuggestion.values.length) {
    event.preventDefault();
    acceptSuggestion(activeSuggestion.values[activeSuggestion.index]);
    return;
  }
  if (event.key === "Tab" && activeSuggestion.values.length) {
    event.preventDefault();
    acceptSuggestion(activeSuggestion.values[activeSuggestion.index]);
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    focusRelativeCell(pos, event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusCell(pos.row - 1, pos.cycle);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusCell(pos.row + 1, pos.cycle);
    return;
  }
  if (event.key === "Delete") {
    event.preventDefault();
    clearCell(pos);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
    event.preventDefault();
    toggleStrike(pos);
    return;
  }
  if (event.key === "Escape") {
    cancelTransientUi();
  }
}

function focusRelativeCell(pos: CellPosition, offset: number): void {
  const total = state.rows.length * state.cycles;
  if (total === 0) return;
  const flat = pos.row * state.cycles + pos.cycle;
  const next = Math.max(0, Math.min(total - 1, flat + offset));
  focusCell(Math.floor(next / state.cycles), next % state.cycles);
}

function focusCell(row: number, cycle: number): void {
  if (row < 0 || row >= state.rows.length || cycle < 0 || cycle >= state.cycles) return;
  const input = getCellElement({ row, cycle });
  if (input) {
    clearRowSelection();
    input.focus();
    input.select();
    setSingleSelection({ row, cycle });
  }
}

function updateSelectionFromClick(pos: CellPosition, event: MouseEvent): void {
  if (event.shiftKey && selectionAnchor) {
    selectedCellKeys = makeRectangularSelection(selectionAnchor, pos);
    return;
  }

  if (event.altKey && selectionAnchor) {
    selectedCellKeys = makeVerticalSelection(selectionAnchor, pos);
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    const key = positionKey(pos);
    selectedCellKeys = new Set(selectedCellKeys);
    if (selectedCellKeys.has(key)) {
      selectedCellKeys.delete(key);
    } else {
      selectedCellKeys.add(key);
    }
    if (!selectedCellKeys.size) selectedCellKeys.add(key);
    selectionAnchor ||= pos;
    return;
  }

  setSingleSelection(pos);
}

function isSelectionModifierClick(event: MouseEvent): boolean {
  return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
}

function setSingleSelection(pos: CellPosition): void {
  clearRowSelection();
  selectedCell = { ...pos };
  selectionAnchor = { ...pos };
  selectedCellKeys = new Set([positionKey(pos)]);
}

function clearSelection(): void {
  selectionAnchor = null;
  selectedCellKeys = new Set();
}

function clearRowSelection(): void {
  rowSelectionAnchor = null;
  selectedRows = new Set();
  refreshRowSelectionClasses();
}

function clearCellSelection(): void {
  selectedCell = null;
  clearSelection();
  refreshCellClasses();
}

function setSingleRowSelection(rowIndex: number): void {
  clearCellSelection();
  rowSelectionAnchor = rowIndex;
  selectedRows = new Set([rowIndex]);
  refreshRowSelectionClasses();
}

function updateRowSelectionFromClick(rowIndex: number, event: MouseEvent): void {
  clearCellSelection();
  if (event.shiftKey && rowSelectionAnchor !== null) {
    const start = Math.min(rowSelectionAnchor, rowIndex);
    const end = Math.max(rowSelectionAnchor, rowIndex);
    selectedRows = new Set(Array.from({ length: end - start + 1 }, (_, offset) => start + offset));
    refreshRowSelectionClasses();
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    selectedRows = new Set(selectedRows);
    if (selectedRows.has(rowIndex)) {
      selectedRows.delete(rowIndex);
    } else {
      selectedRows.add(rowIndex);
    }
    if (!selectedRows.size) selectedRows.add(rowIndex);
    rowSelectionAnchor ||= rowIndex;
    refreshRowSelectionClasses();
    return;
  }

  setSingleRowSelection(rowIndex);
}

function refreshRowSelectionClasses(): void {
  document.querySelectorAll<HTMLElement>(".instruction-cell").forEach((rowElement) => {
    const rowIndex = Number(rowElement.dataset.row);
    rowElement.classList.toggle("row-selected", selectedRows.has(rowIndex));
  });
}

function getActionTargets(fallback: CellPosition): CellPosition[] {
  const positions = getSelectedPositions();
  return positions.length > 1 ? positions : [fallback];
}

function getSelectedPositions(): CellPosition[] {
  return [...selectedCellKeys].map(parsePositionKey).filter((pos) => Boolean(state.rows[pos.row]?.cells[pos.cycle]));
}

function isMultiSelection(): boolean {
  return selectedCellKeys.size > 1;
}

function toggleStrike(pos = selectedCell): void {
  if (!pos) return;
  const cell = state.rows[pos.row].cells[pos.cycle];
  cell.struck = !cell.struck;
  if (cell.struck) removeOutgoingArrows(pos);
  refreshCellClasses();
  scheduleSave();
  window.requestAnimationFrame(drawArrows);
}

function clearCell(pos = selectedCell): void {
  if (!pos) return;
  getActionTargets(pos).forEach((target) => {
    const cell = state.rows[target.row].cells[target.cycle];
    cell.text = "";
    cell.struck = false;
    const input = getCellElement(target);
    if (input) input.value = "";
  });
  autocomplete.hide();
  refreshCellClasses();
  scheduleSave();
  window.requestAnimationFrame(drawArrows);
}

function copyCell(pos = selectedCell): void {
  if (!pos || isMultiSelection()) return;
  const cell = state.rows[pos.row].cells[pos.cycle];
  copiedCell = { text: cell.text, struck: cell.struck };
}

function cutCell(pos = selectedCell): void {
  if (!pos || isMultiSelection()) return;
  copyCell(pos);
  clearCell(pos);
}

function pasteCell(pos = selectedCell): void {
  if (!pos || !copiedCell) return;
  const sourceCell = copiedCell;
  getActionTargets(pos).forEach((target) => {
    const cell = state.rows[target.row].cells[target.cycle];
    cell.text = sourceCell.text;
    cell.struck = sourceCell.struck;
    if (cell.struck) removeOutgoingArrows(target);
    const input = getCellElement(target);
    if (input) input.value = cell.text;
  });
  refreshCellClasses();
  scheduleSave();
  window.requestAnimationFrame(drawArrows);
}

function applyInstructions(): void {
  const lines = elements.instructionsInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const nextRows = lines.map((instruction, index) => {
    const previous = state.rows[index];
    return previous
      ? {
          instruction,
          cells: previous.cells.slice(0, state.cycles).concat(makeMissingCells(previous.cells.length)),
          label: previous.label,
          separatorBefore: previous.separatorBefore
        }
      : makeRow(instruction, state.cycles);
  });

  state.rows = nextRows.map((row) => ({
    instruction: row.instruction,
    cells: Array.from({ length: state.cycles }, (_, index) => row.cells[index] || { text: "", struck: false }),
    label: row.label,
    separatorBefore: row.separatorBefore
  }));
  state.arrows = state.arrows.filter((arrow) => arrow.from.row < state.rows.length && arrow.to.row < state.rows.length);
  selectedCell = null;
  clearSelection();
  clearRowSelection();
  cancelArrowDraft();
  expandDraft = { from: null };
  render();
  scheduleSave();
}

function makeMissingCells(start: number): Array<{ text: string; struck: boolean }> {
  return Array.from({ length: Math.max(0, state.cycles - start) }, () => ({ text: "", struck: false }));
}

function addInstruction(): void {
  state.rows.push(makeRow("", state.cycles));
  clearRowSelection();
  render();
  scheduleSave();
  window.requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(`tbody tr:nth-child(${state.rows.length}) .instruction-cell input`);
    if (input) input.focus();
  });
}

function removeRow(rowIndex: number): void {
  removeSelectedRows([rowIndex]);
}

function removeRowsFrom(rowIndex: number): void {
  removeSelectedRows(getRowActionTargets(rowIndex));
}

function removeSelectedRows(rowIndexes: number[]): void {
  const targets = rowIndexes.filter((index) => index >= 0 && index < state.rows.length);
  if (!targets.length) return;
  const message = targets.length > 1 ? "Delete selected instructions?" : "Delete this instruction?";
  if (targets.some(isRowNonEmpty) && !window.confirm(message)) return;
  if (!removeRows(state, targets)) return;
  clearRowSelection();
  render();
  scheduleSave();
}

function isRowNonEmpty(rowIndex: number): boolean {
  return isInstructionRowNonEmpty(state, rowIndex);
}

function moveRow(rowIndex: number, direction: number): void {
  moveSelectedRows([rowIndex], direction);
}

function moveRowsFrom(rowIndex: number, direction: number): void {
  moveSelectedRows(getRowActionTargets(rowIndex), direction);
}

function moveSelectedRows(rowIndexes: number[], direction: number): void {
  const nextSelection = moveRows(state, rowIndexes, direction);
  if (!nextSelection) return;
  selectedRows = nextSelection;
  rowSelectionAnchor = selectedRows.size ? Math.min(...selectedRows) : null;
  render();
  scheduleSave();
}

function getRowActionTargets(fallback: number): number[] {
  return getSelectedRowTargets(selectedRows, fallback);
}

function changeCycles(): void {
  const nextCycles = Math.max(1, Number.parseInt(elements.cyclesInput.value, 10) || 1);
  if (nextCycles === state.cycles) return;
  if (nextCycles < state.cycles && wouldLoseCells(nextCycles)) {
    const ok = window.confirm("Reducing cycles will delete content. Continue?");
    if (!ok) {
      elements.cyclesInput.value = String(state.cycles);
      return;
    }
  }
  state.cycles = nextCycles;
  state.rows.forEach((row) => {
    if (row.cells.length > nextCycles) row.cells = row.cells.slice(0, nextCycles);
    while (row.cells.length < nextCycles) row.cells.push({ text: "", struck: false });
  });
  state.arrows = state.arrows.filter((arrow) => arrow.from.cycle < nextCycles && arrow.to.cycle < nextCycles);
  render();
  scheduleSave();
}

function wouldLoseCells(nextCycles: number): boolean {
  return state.rows.some((row) => row.cells.slice(nextCycles).some((cell) => cell.text.trim() || cell.struck));
}

function showContextMenu(x: number, y: number): void {
  const currentCell = contextCell ? state.rows[contextCell.row].cells[contextCell.cycle] : null;
  const hasMultipleCells = isMultiSelection();
  const arrowButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="arrow"]');
  if (arrowButton) {
    arrowButton.hidden = hasMultipleCells || Boolean(currentCell?.struck);
  }
  const expandButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="expand"]');
  if (expandButton) {
    expandButton.hidden = hasMultipleCells || !contextCell || !canStartExpand(contextCell);
  }
  const removeButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="remove-arrows"]');
  if (removeButton) {
    const hasOutgoing = contextCell && state.arrows.some((arrow) => samePos(arrow.from, contextCell));
    removeButton.hidden = Boolean(currentCell?.struck) || !hasOutgoing;
  }
  const strikeButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="strike"]');
  if (strikeButton && currentCell) {
    strikeButton.textContent = currentCell.struck ? "Remove strike" : "Strike";
  }
  const copyButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="copy"]');
  if (copyButton) copyButton.hidden = hasMultipleCells;
  const cutButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="cut"]');
  if (cutButton) cutButton.hidden = hasMultipleCells;
  elements.cellMenu.setAttribute("aria-hidden", "false");
  placeFloatingElement(elements.cellMenu, x, y);
}

function hideContextMenu(): void {
  elements.cellMenu.setAttribute("aria-hidden", "true");
}

function positionContextSubmenu(submenu: HTMLElement): void {
  const panel = submenu.querySelector<HTMLElement>(".context-submenu-menu");
  if (!panel) return;
  const side = placeSubmenu(submenu, panel);
  submenu.classList.toggle("submenu-opens-left", side === "left");
}

function showRowContextMenu(x: number, y: number): void {
  const row = contextRow !== null ? state.rows[contextRow] : null;
  const hasMultipleRows = contextRow !== null && selectedRows.size > 1 && selectedRows.has(contextRow);
  const editLabelButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="edit-label"]');
  if (editLabelButton) {
    editLabelButton.textContent = row?.label ? "Edit label" : "Add label";
    editLabelButton.hidden = hasMultipleRows;
  }
  const removeLabelButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="remove-label"]');
  if (removeLabelButton) removeLabelButton.hidden = hasMultipleRows || !row?.label;
  const separatorButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="toggle-separator"]');
  if (separatorButton && row) {
    separatorButton.textContent = row.separatorBefore ? "Remove separator above" : "Add separator above";
    separatorButton.hidden = hasMultipleRows;
  }
  const copyButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="copy"]');
  if (copyButton) copyButton.hidden = hasMultipleRows;
  const cutButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="cut"]');
  if (cutButton) cutButton.hidden = hasMultipleRows;
  elements.rowMenu.setAttribute("aria-hidden", "false");
  placeFloatingElement(elements.rowMenu, x, y);
}

function hideRowContextMenu(): void {
  elements.rowMenu.setAttribute("aria-hidden", "true");
}

function handleContextAction(action: ContextAction): void {
  if (!contextCell) return;
  if (action === "arrow") startArrow(contextCell);
  if (action === "remove-arrows") removeArrowsFrom(contextCell);
  if (action === "strike") toggleStrike(contextCell);
  if (action === "expand") startExpand(contextCell);
  if (action === "copy") copyCell(contextCell);
  if (action === "cut") cutCell(contextCell);
  if (action === "paste") pasteCell(contextCell);
  if (action === "clear") clearCell(contextCell);
  hideContextMenu();
}

function handleRowContextAction(action: RowContextAction): void {
  if (contextRow === null) return;
  if (action === "edit-label") editRowLabel(contextRow);
  if (action === "remove-label") removeRowLabel(contextRow);
  if (action === "toggle-separator") toggleRowSeparator(contextRow);
  if (action === "copy") copyInstruction(contextRow);
  if (action === "cut") cutInstruction(contextRow);
  if (action === "paste") pasteInstruction(contextRow);
  if (action === "clear") clearInstruction(contextRow);
  hideRowContextMenu();
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
  contextRow = Number(target.dataset.row);
  if (!selectedRows.has(contextRow)) setSingleRowSelection(contextRow);
  hideContextMenu();
  autocomplete.hide();
  showRowContextMenu(event.clientX, event.clientY);
}

function editRowLabel(rowIndex: number): void {
  labelEditRow = rowIndex;
  const current = state.rows[rowIndex].label || "";
  elements.labelModalTitle.textContent = current ? "Edit label" : "Add label";
  elements.labelInput.value = current;
  elements.labelModal.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    elements.labelInput.focus();
    elements.labelInput.select();
  });
}

function saveRowLabel(): void {
  if (labelEditRow === null) return;
  const label = normalizeRowLabel(elements.labelInput.value);
  if (label) {
    state.rows[labelEditRow].label = label;
  } else {
    delete state.rows[labelEditRow].label;
  }
  hideLabelModal();
  render();
  scheduleSave();
}

function hideLabelModal(): void {
  labelEditRow = null;
  elements.labelModal.setAttribute("aria-hidden", "true");
}

function removeRowLabel(rowIndex: number): void {
  delete state.rows[rowIndex].label;
  render();
  scheduleSave();
}

function toggleRowSeparator(rowIndex: number): void {
  state.rows[rowIndex].separatorBefore = !state.rows[rowIndex].separatorBefore;
  if (!state.rows[rowIndex].separatorBefore) delete state.rows[rowIndex].separatorBefore;
  render();
  scheduleSave();
}

function clearInstruction(rowIndex: number): void {
  getRowActionTargets(rowIndex).forEach((target) => {
    state.rows[target].instruction = "";
  });
  elements.instructionsInput.value = state.rows.map((row) => row.instruction).join("\n");
  render();
  scheduleSave();
}

function copyInstruction(rowIndex: number): void {
  if (selectedRows.size > 1) return;
  copiedInstruction = state.rows[rowIndex].instruction;
}

function cutInstruction(rowIndex: number): void {
  if (selectedRows.size > 1) return;
  copyInstruction(rowIndex);
  clearInstruction(rowIndex);
}

function pasteInstruction(rowIndex: number): void {
  if (copiedInstruction === null) return;
  getRowActionTargets(rowIndex).forEach((target) => {
    state.rows[target].instruction = copiedInstruction ?? "";
  });
  elements.instructionsInput.value = state.rows.map((row) => row.instruction).join("\n");
  render();
  scheduleSave();
}

function startArrow(pos: CellPosition): void {
  if (state.rows[pos.row].cells[pos.cycle].struck) return;
  expandDraft = { from: null };
  arrowDraft = { from: { ...pos } };
  arrowHoverTarget = null;
  refreshCellClasses();
  renderSelectionInfo();
}

function startExpand(pos: CellPosition): void {
  if (!canStartExpand(pos)) return;
  cancelArrowDraft();
  expandDraft = { from: { ...pos } };
  refreshCellClasses();
  renderSelectionInfo();
}

function removeArrowsFrom(pos: CellPosition): void {
  if (removeOutgoingArrows(pos)) {
    render();
    scheduleSave();
  }
}

function tryCreateArrowTo(to: CellPosition): void {
  const from = arrowDraft.from;
  if (!from) return;
  autocomplete.hide();
  if (state.rows[from.row].cells[from.cycle].struck) {
    cancelArrowDraft();
    refreshCellClasses();
    return;
  }
  if (!isValidArrowTarget(from, to, state)) {
    cancelArrowDraft();
    refreshCellClasses();
    showStatus("Invalid target");
    window.setTimeout(() => {
      showStatus("");
    }, 1400);
    return;
  }
  state.arrows.push({ from: { ...from }, to: { ...to }, label: "" });
  cancelArrowDraft();
  render();
  scheduleSave();
}

function cancelArrowDraft(): void {
  arrowDraft = { from: null };
  arrowHoverTarget = null;
}

function tryExpandTo(to: CellPosition): void {
  const from = expandDraft.from;
  if (!from) return;
  if (to.row !== from.row || to.cycle <= from.cycle) {
    showStatus("Invalid target");
    window.setTimeout(() => {
      showStatus("");
    }, 1400);
    expandDraft = { from: null };
    refreshCellClasses();
    return;
  }

  const values = makeExpansionValues(state, from, to);
  if (!values) {
    expandDraft = { from: null };
    refreshCellClasses();
    return;
  }

  if (wouldChangeFilledCells(state, from, values) && !window.confirm("Expansion will overwrite filled cells. Continue?")) {
    expandDraft = { from: null };
    refreshCellClasses();
    return;
  }

  values.forEach((text, offset) => {
    const cell = state.rows[from.row].cells[from.cycle + offset];
    cell.text = text;
    cell.struck = false;
    const input = getCellElement({ row: from.row, cycle: from.cycle + offset });
    if (input) input.value = text;
  });
  expandDraft = { from: null };
  render();
  scheduleSave();
}

function canStartExpand(pos: CellPosition): boolean {
  return canStartExpandStage(state, pos);
}

function removeArrow(index: number): void {
  state.arrows.splice(index, 1);
  render();
  scheduleSave();
}

function drawArrows(): void {
  drawArrowLayer(elements.cycleViewport, elements.arrowLayer, state, getCellElement, removeArrow);
}

function getCellElement(pos: CellPosition): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(`.stage-input[data-row="${pos.row}"][data-cycle="${pos.cycle}"]`);
}

function renderSelectionInfo(): void {
  refreshCellClasses();
}

function acceptSuggestion(value: string): void {
  const pos = autocomplete.active.pos || selectedCell;
  if (!pos) return;
  const cell = state.rows[pos.row].cells[pos.cycle];
  cell.text = value;
  const input = getCellElement(pos);
  if (input) {
    input.value = value;
    input.focus();
  }
  autocomplete.hide();
  refreshCellClasses();
  scheduleSave();
}

function hideAutocompleteIfFocusLeftCells(): void {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement && activeElement.classList.contains("stage-input")) return;
  autocomplete.hide();
}

async function showExport(format: ExportFormat): Promise<void> {
  if (format === "png") {
    await downloadPngExport();
    return;
  }
  const output = format === "json" ? exportJson(state) : format === "markdown" ? exportMarkdown(state) : exportText(state);
  elements.exportOutput.value = output;
  elements.exportModal.setAttribute("aria-hidden", "false");
}

async function downloadPngExport(): Promise<void> {
  try {
    const blob = await exportPng(state);
    downloadBlob(blob, `${makeDownloadSlug(state.title || "pipeline-table")}.png`);
    showStatus("PNG exported");
  } catch (error) {
    window.alert(`PNG export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hideExport(): void {
  elements.exportModal.setAttribute("aria-hidden", "true");
}

function toggleExportMenu(): void {
  const isOpen = elements.exportMenu.getAttribute("aria-hidden") === "false";
  elements.exportMenu.setAttribute("aria-hidden", isOpen ? "true" : "false");
  elements.exportMenuBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
}

function hideExportMenu(): void {
  elements.exportMenu.setAttribute("aria-hidden", "true");
  elements.exportMenuBtn.setAttribute("aria-expanded", "false");
}

function importJson(): void {
  try {
    const raw = JSON.parse(elements.importInput.value) as Partial<AppState>;
    state = normalizeState(raw);
    pruneArrowsFromStruckCells();
    selectedCell = null;
    clearSelection();
    cancelArrowDraft();
    expandDraft = { from: null };
    render();
    saveState(true);
  } catch (error) {
    window.alert(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function copyExport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(elements.exportOutput.value);
    showStatus("Copied");
  } catch {
    elements.exportOutput.focus();
    elements.exportOutput.select();
    showStatus("Select and copy");
  }
}

function clearAll(): void {
  if (!window.confirm("Clear the whole table?")) return;
  state = createDefaultState();
  selectedCell = null;
  clearSelection();
  cancelArrowDraft();
  expandDraft = { from: null };
  render();
  saveState(true);
}

function removeOutgoingArrows(pos: CellPosition): boolean {
  const before = state.arrows.length;
  state.arrows = state.arrows.filter((arrow) => !samePos(arrow.from, pos));
  return state.arrows.length !== before;
}

function pruneArrowsFromStruckCells(): boolean {
  const before = state.arrows.length;
  state.arrows = state.arrows.filter((arrow) => !state.rows[arrow.from.row]?.cells[arrow.from.cycle]?.struck);
  return state.arrows.length !== before;
}

function scheduleSave(): void {
  showStatus("");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveState(false), 250);
}

function saveState(manual: boolean): void {
  saveStateToStorage(state);
  showStatus(manual ? "Guardado" : "");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    showStatus("");
  }, 1400);
}

function showStatus(message: string): void {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("is-visible", Boolean(message));
}

function cancelTransientUi(): void {
  cancelArrowDraft();
  expandDraft = { from: null };
  hideContextMenu();
  hideRowContextMenu();
  autocomplete.hide();
  hideExport();
  hideLabelModal();
  refreshCellClasses();
  renderSelectionInfo();
}

elements.titleInput.addEventListener("input", () => {
  state.title = elements.titleInput.value;
  scheduleSave();
});
elements.cyclesInput.addEventListener("change", changeCycles);
elements.instructionsInput.addEventListener("input", applyInstructions);
elements.exportMenuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleExportMenu();
});
elements.exportMenu.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-export-format]") : null;
  if (!button) return;
  hideExportMenu();
  void showExport(button.dataset.exportFormat as ExportFormat);
});
elements.copyExportBtn.addEventListener("click", copyExport);
elements.importBtn.addEventListener("click", importJson);
elements.clearBtn.addEventListener("click", clearAll);
elements.collapseSidebarBtn.addEventListener("click", () => {
  elements.layoutRoot.classList.add("sidebar-collapsed");
  window.requestAnimationFrame(drawArrows);
});
elements.expandSidebarBtn.addEventListener("click", () => {
  elements.layoutRoot.classList.remove("sidebar-collapsed");
  window.requestAnimationFrame(drawArrows);
});
elements.closeExportBtn.addEventListener("click", hideExport);
elements.exportModal.addEventListener("click", (event) => {
  if (event.target === elements.exportModal) hideExport();
});
elements.saveLabelBtn.addEventListener("click", saveRowLabel);
elements.cancelLabelBtn.addEventListener("click", hideLabelModal);
elements.labelInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveRowLabel();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    hideLabelModal();
  }
});
elements.labelModal.addEventListener("click", (event) => {
  if (event.target === elements.labelModal) hideLabelModal();
});
elements.cellMenu.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
  if (button) handleContextAction(button.dataset.action as ContextAction);
});
elements.cellMenu.querySelectorAll<HTMLElement>(".context-submenu").forEach((submenu) => {
  submenu.addEventListener("mouseenter", () => positionContextSubmenu(submenu));
  submenu.addEventListener("focusin", () => positionContextSubmenu(submenu));
});
elements.rowMenu.querySelectorAll<HTMLElement>(".context-submenu").forEach((submenu) => {
  submenu.addEventListener("mouseenter", () => positionContextSubmenu(submenu));
  submenu.addEventListener("focusin", () => positionContextSubmenu(submenu));
});
elements.rowMenu.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-row-action]") : null;
  if (button) handleRowContextAction(button.dataset.rowAction as RowContextAction);
});
elements.autocompleteMenu.addEventListener("autocomplete:accept", (event) => {
  acceptSuggestion((event as CustomEvent<string>).detail);
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !elements.cellMenu.contains(event.target)) hideContextMenu();
  if (event.target instanceof Node && !elements.rowMenu.contains(event.target)) hideRowContextMenu();
  if (event.target instanceof Node && !elements.exportMenu.contains(event.target) && event.target !== elements.exportMenuBtn) {
    hideExportMenu();
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
