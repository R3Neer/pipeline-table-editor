import type { AppState } from "../core/model";
import type { AppElements } from "../ui/dom";
import { getInputPosition } from "../ui/dom";
import { updateInstructionColumnWidth } from "../ui/instructionColumnWidth";
import type { SplitTableController } from "../ui/splitTable";
import { makeHeader, makeInstructionScrollbarSpacer } from "../ui/tableElements";
import type { CellEditingController } from "./cellEditingController";
import { createInstructionEditorRenderer } from "./instructionEditorRenderer";
import type { RowEditingController } from "./rowEditingController";
import type { SelectionController } from "./selectionController";

interface TableRendererOptions {
  elements: AppElements;
  splitTable: SplitTableController;
  selection: SelectionController;
  cellEditing: CellEditingController;
  rowEditing: RowEditingController;
  getState(): AppState;
  getCellClassForPosition(row: number, cycle: number): string;
  clearCellSelection(): void;
  scheduleSave(): void;
  drawArrows(): void;
  onInstructionClick(event: MouseEvent): void;
  onInstructionContextMenu(event: MouseEvent): void;
}

export interface TableRenderer {
  renderTable(): void;
  refreshCellClasses(): void;
  refreshRowSelectionClasses(): void;
}

export function createTableRenderer({
  elements,
  splitTable,
  selection,
  cellEditing,
  rowEditing,
  getState,
  getCellClassForPosition,
  clearCellSelection,
  scheduleSave,
  drawArrows,
  onInstructionClick,
  onInstructionContextMenu
}: TableRendererOptions): TableRenderer {
  const instructionEditor = createInstructionEditorRenderer({
    elements,
    splitTable,
    selection,
    rowEditing,
    getState,
    clearCellSelection,
    scheduleSave,
    drawArrows,
    onInstructionClick,
    onInstructionContextMenu
  });

  function renderTable(): void {
    const state = getState();
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
      instructionTd.appendChild(instructionEditor.makeInstructionEditor(rowIndex));
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
      instructionEditor.makeAddRowZone()
    );
    elements.tableMount.replaceChildren(cycleTable);
    updateInstructionColumnWidth(elements);
    splitTable.syncLayout();
    window.requestAnimationFrame(() => {
      splitTable.syncLayout();
      drawArrows();
    });
  }

  function refreshCellClasses(): void {
    document.querySelectorAll<HTMLInputElement>(".stage-input").forEach((input) => {
      const pos = getInputPosition(input);
      input.className = getCellClassForPosition(pos.row, pos.cycle);
    });
  }

  function refreshRowSelectionClasses(): void {
    document.querySelectorAll<HTMLElement>(".instruction-cell").forEach((rowElement) => {
      const rowIndex = Number(rowElement.dataset.row);
      rowElement.classList.toggle("row-selected", selection.hasSelectedRow(rowIndex));
    });
  }

  return {
    renderTable,
    refreshCellClasses,
    refreshRowSelectionClasses
  };
}
