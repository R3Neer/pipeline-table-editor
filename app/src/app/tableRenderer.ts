import { getKnownLabels, getLabelColor } from "../core/labels";
import type { AppState } from "../core/model";
import { renderAssemblyHighlight } from "../ui/assemblyHighlight";
import type { AppElements } from "../ui/dom";
import { getInputPosition } from "../ui/dom";
import { updateInstructionColumnWidth } from "../ui/instructionColumnWidth";
import type { SplitTableController } from "../ui/splitTable";
import { makeHeader, makeInstructionScrollbarSpacer, makeRowButton } from "../ui/tableElements";
import type { CellEditingController } from "./cellEditingController";
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
    elements.instructionMount.replaceChildren(instructionTable, makeInstructionScrollbarSpacer(), makeAddRowZone());
    elements.tableMount.replaceChildren(cycleTable);
    updateInstructionColumnWidth(elements);
    splitTable.syncLayout();
    window.requestAnimationFrame(() => {
      splitTable.syncLayout();
      drawArrows();
    });
  }

  function makeInstructionEditor(rowIndex: number): HTMLElement {
    const state = getState();
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
      const currentState = getState();
      currentState.rows[rowIndex].instruction = input.value;
      elements.instructionsInput.value = currentState.rows.map((item) => item.instruction).join("\n");
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

  function getAllLabels(): string[] {
    return getKnownLabels(getState().rows.map((row) => row.label));
  }

  return {
    renderTable,
    refreshCellClasses,
    refreshRowSelectionClasses
  };
}
