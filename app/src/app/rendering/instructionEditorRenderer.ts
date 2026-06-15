import { getKnownLabels, getLabelColor } from "../../core/labels";
import type { AppState } from "../../core/model";
import { renderAssemblyHighlight } from "../../ui/assemblyHighlight";
import type { AppElements } from "../../ui/dom";
import { updateInstructionColumnWidth } from "../../ui/instructionColumnWidth";
import type { SplitTableController } from "../../ui/splitTable";
import { makeRowButton } from "../../ui/tableElements";
import type { RowEditingController } from "../rows/rowEditingController";
import type { SelectionController } from "../selection/selectionController";

interface InstructionEditorRendererOptions {
  elements: AppElements;
  splitTable: SplitTableController;
  selection: SelectionController;
  rowEditing: RowEditingController;
  getState(): AppState;
  clearCellSelection(): void;
  scheduleSave(): void;
  drawArrows(): void;
  onInstructionClick(event: MouseEvent): void;
  onInstructionContextMenu(event: MouseEvent): void;
}

export interface InstructionEditorRenderer {
  makeInstructionEditor(rowIndex: number): HTMLElement;
  makeAddRowZone(): HTMLElement;
}

interface AddRowHoverScroll {
  top: number;
  committed: boolean;
}

const addRowHoverBottomMargin = 12;

export function createInstructionEditorRenderer({
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
}: InstructionEditorRendererOptions): InstructionEditorRenderer {
  let addRowHoverScroll: AddRowHoverScroll | null = null;

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
    button.addEventListener("click", () => {
      if (addRowHoverScroll) addRowHoverScroll.committed = true;
      rowEditing.addInstruction();
    });
    zone.addEventListener("mouseenter", () => revealAddRowButton(button));
    zone.addEventListener("mouseleave", restoreAddRowHoverScroll);
    zone.appendChild(button);
    return zone;
  }

  function revealAddRowButton(button: HTMLElement): void {
    addRowHoverScroll = null;
    const shell = elements.tableShell;
    if (shell.scrollHeight <= shell.clientHeight) return;

    const shellRect = shell.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const overflow = buttonRect.bottom + addRowHoverBottomMargin - shellRect.bottom;
    if (overflow <= 0) return;

    const originalTop = shell.scrollTop;
    const maxTop = shell.scrollHeight - shell.clientHeight;
    const nextTop = Math.min(maxTop, originalTop + overflow);
    if (nextTop === originalTop) return;

    addRowHoverScroll = { top: originalTop, committed: false };
    shell.scrollTop = nextTop;
    window.requestAnimationFrame(drawArrows);
  }

  function restoreAddRowHoverScroll(): void {
    const scroll = addRowHoverScroll;
    addRowHoverScroll = null;
    if (!scroll || scroll.committed) return;
    elements.tableShell.scrollTop = scroll.top;
    window.requestAnimationFrame(drawArrows);
  }

  function syncAssemblyHighlight(input: HTMLInputElement, highlight: HTMLElement): void {
    const isAnnotation = renderAssemblyHighlight(highlight, input.value, getAllLabels());
    input.classList.toggle("assembly-input-annotation", isAnnotation);
  }

  function getAllLabels(): string[] {
    return getKnownLabels(getState().rows.map((row) => row.label));
  }

  return { makeInstructionEditor, makeAddRowZone };
}

