import "./styles.css";

import { canStartExpand as canStartExpandStage, makeExpansionValues, wouldChangeFilledCells } from "./core/expansion";
import type {
  AppState,
  ArrowDraft,
  CellPosition,
  ContextAction,
  CopiedCell,
  ExpandDraft,
  ExportFormat
} from "./core/model";
import { makeRectangularSelection, makeVerticalSelection, parsePositionKey, positionKey } from "./core/selection";
import { createDefaultState, loadState, makeRow, normalizeState, saveStateToStorage } from "./core/state";
import {
  getValidRoot,
  isCellTextValid,
  isValidArrowTarget,
  normalizeCellText,
  remapMovedRow,
  samePos
} from "./core/validation";
import { exportJson, exportMarkdown, exportPng, exportText } from "./export/index";
import { drawArrows as drawArrowLayer } from "./ui/arrows";
import { createAutocompleteController } from "./ui/autocomplete";
import { getAppElements, getInputPosition, renderAssemblyHighlight } from "./ui/dom";
import { downloadBlob, makeDownloadSlug } from "./ui/download";

const elements = getAppElements();
const autocomplete = createAutocompleteController(elements.autocompleteMenu);

let state: AppState = loadState() || createDefaultState();
let selectedCell: CellPosition | null = null;
let selectionAnchor: CellPosition | null = null;
let selectedCellKeys = new Set<string>();
let contextCell: CellPosition | null = null;
let copiedCell: CopiedCell | null = null;
let arrowDraft: ArrowDraft = { from: null };
let expandDraft: ExpandDraft = { from: null };
let saveTimer = 0;

function render(): void {
  elements.titleInput.value = state.title;
  elements.cyclesInput.value = String(state.cycles);
  elements.instructionsInput.value = state.rows.map((row) => row.instruction).join("\n");
  renderTable();
  renderSelectionInfo();
  window.requestAnimationFrame(drawArrows);
}

function renderTable(): void {
  const table = document.createElement("table");
  table.className = "pipeline-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(makeHeader("Instruction", "instruction-col"));
  for (let cycle = 1; cycle <= state.cycles; cycle += 1) {
    headRow.appendChild(makeHeader(String(cycle), "cycle-col"));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const instructionTd = document.createElement("td");
    instructionTd.className = "instruction-col";
    instructionTd.appendChild(makeInstructionEditor(row.instruction, rowIndex));
    tr.appendChild(instructionTd);

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
      input.addEventListener("contextmenu", onCellContextMenu);
      input.addEventListener("blur", () => window.setTimeout(hideAutocompleteIfFocusLeftCells, 120));
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  elements.tableMount.replaceChildren(table, makeAddRowZone());
}

function makeHeader(text: string, className: string): HTMLTableCellElement {
  const th = document.createElement("th");
  th.className = className;
  th.textContent = text;
  return th;
}

function makeInstructionEditor(instruction: string, rowIndex: number): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "instruction-cell";

  const editor = document.createElement("div");
  editor.className = "assembly-editor";
  const highlight = document.createElement("div");
  highlight.className = "assembly-highlight";
  highlight.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.className = "assembly-input";
  input.value = instruction;
  input.spellcheck = false;
  renderAssemblyHighlight(highlight, input.value);
  input.addEventListener("input", () => {
    state.rows[rowIndex].instruction = input.value;
    elements.instructionsInput.value = state.rows.map((item) => item.instruction).join("\n");
    renderAssemblyHighlight(highlight, input.value);
    scheduleSave();
    window.requestAnimationFrame(drawArrows);
  });
  input.addEventListener("scroll", () => {
    highlight.scrollLeft = input.scrollLeft;
  });

  editor.append(highlight, input);
  wrapper.append(
    editor,
    makeRowButton("↑", () => moveRow(rowIndex, -1)),
    makeRowButton("↓", () => moveRow(rowIndex, 1)),
    makeRowButton("×", () => removeRow(rowIndex), "row-delete-button")
  );
  return wrapper;
}

function makeRowButton(text: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `row-btn${extraClass ? ` ${extraClass}` : ""}`;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
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
  selectedCell = getInputPosition(input);
  if (!selectionAnchor) setSingleSelection(selectedCell);
  hideContextMenu();
  refreshCellClasses();
  renderSelectionInfo();
  autocomplete.show(input, selectedCell, state);
}

function onCellClick(event: MouseEvent): void {
  const input = event.currentTarget as HTMLInputElement;
  selectedCell = getInputPosition(input);
  hideContextMenu();
  if (expandDraft.from && !samePos(expandDraft.from, selectedCell)) {
    tryExpandTo(selectedCell);
    return;
  }
  if (arrowDraft.from && !samePos(arrowDraft.from, selectedCell)) {
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

function onCellContextMenu(event: MouseEvent): void {
  event.preventDefault();
  const input = event.currentTarget as HTMLInputElement;
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
  selectedCell = { ...pos };
  selectionAnchor = { ...pos };
  selectedCellKeys = new Set([positionKey(pos)]);
}

function clearSelection(): void {
  selectionAnchor = null;
  selectedCellKeys = new Set();
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
      ? { instruction, cells: previous.cells.slice(0, state.cycles).concat(makeMissingCells(previous.cells.length)) }
      : makeRow(instruction, state.cycles);
  });

  state.rows = nextRows.map((row) => ({
    instruction: row.instruction,
    cells: Array.from({ length: state.cycles }, (_, index) => row.cells[index] || { text: "", struck: false })
  }));
  state.arrows = state.arrows.filter((arrow) => arrow.from.row < state.rows.length && arrow.to.row < state.rows.length);
  selectedCell = null;
  clearSelection();
  arrowDraft = { from: null };
  expandDraft = { from: null };
  render();
  scheduleSave();
}

function makeMissingCells(start: number): Array<{ text: string; struck: boolean }> {
  return Array.from({ length: Math.max(0, state.cycles - start) }, () => ({ text: "", struck: false }));
}

function addInstruction(): void {
  state.rows.push(makeRow("", state.cycles));
  render();
  scheduleSave();
  window.requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(`tbody tr:nth-child(${state.rows.length}) .instruction-cell input`);
    if (input) input.focus();
  });
}

function removeRow(rowIndex: number): void {
  if (isRowNonEmpty(rowIndex) && !window.confirm("Delete this instruction?")) return;
  state.rows.splice(rowIndex, 1);
  state.arrows = state.arrows
    .filter((arrow) => arrow.from.row !== rowIndex && arrow.to.row !== rowIndex)
    .map((arrow) => ({
      ...arrow,
      from: { ...arrow.from, row: arrow.from.row > rowIndex ? arrow.from.row - 1 : arrow.from.row },
      to: { ...arrow.to, row: arrow.to.row > rowIndex ? arrow.to.row - 1 : arrow.to.row }
    }));
  render();
  scheduleSave();
}

function isRowNonEmpty(rowIndex: number): boolean {
  const row = state.rows[rowIndex];
  if (!row) return false;
  return Boolean(
    row.instruction.trim() ||
      row.cells.some((cell) => cell.text.trim() || cell.struck) ||
      state.arrows.some((arrow) => arrow.from.row === rowIndex || arrow.to.row === rowIndex)
  );
}

function moveRow(rowIndex: number, direction: number): void {
  const target = rowIndex + direction;
  if (target < 0 || target >= state.rows.length) return;
  const [row] = state.rows.splice(rowIndex, 1);
  state.rows.splice(target, 0, row);
  state.arrows = state.arrows
    .map((arrow) => ({
      ...arrow,
      from: remapMovedRow(arrow.from, rowIndex, target),
      to: remapMovedRow(arrow.to, rowIndex, target)
    }))
    .filter((arrow) => isValidArrowTarget(arrow.from, arrow.to, state));
  render();
  scheduleSave();
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
  elements.cellMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  elements.cellMenu.style.top = `${Math.min(y, window.innerHeight - 190)}px`;
  elements.cellMenu.setAttribute("aria-hidden", "false");
}

function hideContextMenu(): void {
  elements.cellMenu.setAttribute("aria-hidden", "true");
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

function startArrow(pos: CellPosition): void {
  if (state.rows[pos.row].cells[pos.cycle].struck) return;
  expandDraft = { from: null };
  arrowDraft = { from: { ...pos } };
  refreshCellClasses();
  renderSelectionInfo();
}

function startExpand(pos: CellPosition): void {
  if (!canStartExpand(pos)) return;
  arrowDraft = { from: null };
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
  if (state.rows[from.row].cells[from.cycle].struck) {
    arrowDraft = { from: null };
    refreshCellClasses();
    return;
  }
  if (!isValidArrowTarget(from, to, state)) {
    showStatus("Invalid target");
    window.setTimeout(() => {
      showStatus("");
    }, 1400);
    return;
  }
  state.arrows.push({ from: { ...from }, to: { ...to }, label: "" });
  arrowDraft = { from: null };
  render();
  scheduleSave();
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
  drawArrowLayer(elements.tableShell, elements.arrowLayer, state, getCellElement, removeArrow);
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
    arrowDraft = { from: null };
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
  arrowDraft = { from: null };
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
  arrowDraft = { from: null };
  expandDraft = { from: null };
  hideContextMenu();
  autocomplete.hide();
  hideExport();
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
elements.saveBtn.addEventListener("click", () => saveState(true));
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
elements.cellMenu.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
  if (button) handleContextAction(button.dataset.action as ContextAction);
});
elements.autocompleteMenu.addEventListener("autocomplete:accept", (event) => {
  acceptSuggestion((event as CustomEvent<string>).detail);
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !elements.cellMenu.contains(event.target)) hideContextMenu();
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
elements.tableShell.addEventListener("scroll", drawArrows);
window.addEventListener("resize", drawArrows);

pruneArrowsFromStruckCells();
render();
saveState(false);
