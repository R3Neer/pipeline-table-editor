import type { AppState, CellPosition } from "../core/model";
import type { CopiedCell } from "./sessionTypes";
import type { SelectionController } from "./selectionController";

export interface CellActionController {
  toggleStrike(pos?: CellPosition | null): void;
  clearCell(pos?: CellPosition | null): void;
  copyCell(pos?: CellPosition | null): void;
  cutCell(pos?: CellPosition | null): void;
  pasteCell(pos?: CellPosition | null): void;
}

interface CellActionControllerOptions {
  selection: SelectionController;
  getState(): AppState;
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  hideAutocomplete(): void;
  refreshCellClasses(): void;
  scheduleSave(): void;
  drawArrows(): void;
  removeOutgoingArrows(pos: CellPosition): boolean;
}

export function createCellActionController({
  selection,
  getState,
  getCellElement,
  hideAutocomplete,
  refreshCellClasses,
  scheduleSave,
  drawArrows,
  removeOutgoingArrows
}: CellActionControllerOptions): CellActionController {
  let copiedCell: CopiedCell | null = null;

  function toggleStrike(pos = selection.getSelectedCell()): void {
    if (!pos) return;
    const state = getState();
    const cell = state.rows[pos.row].cells[pos.cycle];
    cell.struck = !cell.struck;
    if (cell.struck) removeOutgoingArrows(pos);
    refreshCellClasses();
    scheduleSave();
    window.requestAnimationFrame(drawArrows);
  }

  function clearCell(pos = selection.getSelectedCell()): void {
    if (!pos) return;
    const state = getState();
    getActionTargets(pos, state).forEach((target) => {
      const cell = state.rows[target.row].cells[target.cycle];
      cell.text = "";
      cell.struck = false;
      const input = getCellElement(target);
      if (input) input.value = "";
    });
    hideAutocomplete();
    refreshCellClasses();
    scheduleSave();
    window.requestAnimationFrame(drawArrows);
  }

  function copyCell(pos = selection.getSelectedCell()): void {
    if (!pos || selection.isMultiSelection()) return;
    const cell = getState().rows[pos.row].cells[pos.cycle];
    copiedCell = { text: cell.text, struck: cell.struck };
  }

  function cutCell(pos = selection.getSelectedCell()): void {
    if (!pos || selection.isMultiSelection()) return;
    copyCell(pos);
    clearCell(pos);
  }

  function pasteCell(pos = selection.getSelectedCell()): void {
    if (!pos || !copiedCell) return;
    const state = getState();
    const sourceCell = copiedCell;
    getActionTargets(pos, state).forEach((target) => {
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

  function getActionTargets(fallback: CellPosition, state: AppState): CellPosition[] {
    return selection.getCellActionTargets(fallback, state);
  }

  return {
    toggleStrike,
    clearCell,
    copyCell,
    cutCell,
    pasteCell
  };
}

