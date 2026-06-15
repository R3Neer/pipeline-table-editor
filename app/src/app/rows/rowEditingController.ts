import type { AppState } from "../../core/model";
import {
  isRowNonEmpty as isInstructionRowNonEmpty,
  moveRows,
  removeRows
} from "../../core/rows";
import { makeRow } from "../../core/state";
import type { AppElements } from "../../ui/dom";
import type { SelectionController } from "../selection/selectionController";

export interface RowEditingController {
  addInstruction(): void;
  removeRowsFrom(rowIndex: number): void;
  moveRowsFrom(rowIndex: number, direction: number): void;
  removeRowLabel(rowIndex: number): void;
  toggleRowSeparator(rowIndex: number): void;
  clearInstruction(rowIndex: number): void;
  copyInstruction(rowIndex: number): void;
  cutInstruction(rowIndex: number): void;
  pasteInstruction(rowIndex: number): void;
}

interface RowEditingControllerOptions {
  elements: AppElements;
  selection: SelectionController;
  getState(): AppState;
  render(): void;
  scheduleSave(): void;
  showConfirm(title: string, message: string, acceptLabel?: string): Promise<boolean>;
}

export function createRowEditingController({
  elements,
  selection,
  getState,
  render,
  scheduleSave,
  showConfirm
}: RowEditingControllerOptions): RowEditingController {
  let copiedInstruction: string | null = null;

  function addInstruction(): void {
    const state = getState();
    state.rows.push(makeRow("", state.cycles));
    selection.clearRowSelection();
    render();
    scheduleSave();
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`tbody tr:nth-child(${state.rows.length}) .instruction-cell input`);
      if (input) input.focus();
    });
  }

  function removeRowsFrom(rowIndex: number): void {
    void removeSelectedRows(selection.getRowActionTargets(rowIndex));
  }

  async function removeSelectedRows(rowIndexes: number[]): Promise<void> {
    const state = getState();
    const targets = rowIndexes.filter((index) => index >= 0 && index < state.rows.length);
    if (!targets.length) return;
    const message = targets.length > 1 ? "Delete selected instructions?" : "Delete this instruction?";
    if (targets.some((rowIndex) => isInstructionRowNonEmpty(state, rowIndex)) && !(await showConfirm("Delete instructions", message, "Delete"))) {
      return;
    }
    if (!removeRows(state, targets)) return;
    selection.clearRowSelection();
    render();
    scheduleSave();
  }

  function moveRowsFrom(rowIndex: number, direction: number): void {
    const state = getState();
    const nextSelection = moveRows(state, selection.getRowActionTargets(rowIndex), direction);
    if (!nextSelection) return;
    selection.replaceRowSelection(nextSelection);
    render();
    scheduleSave();
  }

  function removeRowLabel(rowIndex: number): void {
    delete getState().rows[rowIndex].label;
    render();
    scheduleSave();
  }

  function toggleRowSeparator(rowIndex: number): void {
    const row = getState().rows[rowIndex];
    row.separatorBefore = !row.separatorBefore;
    if (!row.separatorBefore) delete row.separatorBefore;
    render();
    scheduleSave();
  }

  function clearInstruction(rowIndex: number): void {
    const state = getState();
    selection.getRowActionTargets(rowIndex).forEach((target) => {
      state.rows[target].instruction = "";
    });
    syncInstructionsInput(state);
    render();
    scheduleSave();
  }

  function copyInstruction(rowIndex: number): void {
    if (selection.getSelectedRows().size > 1) return;
    copiedInstruction = getState().rows[rowIndex].instruction;
  }

  function cutInstruction(rowIndex: number): void {
    if (selection.getSelectedRows().size > 1) return;
    copyInstruction(rowIndex);
    clearInstruction(rowIndex);
  }

  function pasteInstruction(rowIndex: number): void {
    if (copiedInstruction === null) return;
    const state = getState();
    selection.getRowActionTargets(rowIndex).forEach((target) => {
      state.rows[target].instruction = copiedInstruction ?? "";
    });
    syncInstructionsInput(state);
    render();
    scheduleSave();
  }

  function syncInstructionsInput(state: AppState): void {
    elements.instructionsInput.value = state.rows.map((row) => row.instruction).join("\n");
  }

  return {
    addInstruction,
    removeRowsFrom,
    moveRowsFrom,
    removeRowLabel,
    toggleRowSeparator,
    clearInstruction,
    copyInstruction,
    cutInstruction,
    pasteInstruction
  };
}


