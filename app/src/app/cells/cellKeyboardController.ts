import type { AppState, CellPosition } from "../../core/model";
import { getInputPosition } from "../../ui/dom";
import type { SelectionController } from "../selection/selectionController";

interface CellKeyboardControllerOptions {
  selection: SelectionController;
  getState(): AppState;
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  autocomplete: {
    active: { pos: CellPosition | null; values: string[]; index: number };
    hide(): void;
    move(direction: number): void;
  };
  clearRowSelection(): void;
  setSingleSelection(pos: CellPosition): void;
  cancelTransientUi(): void;
  refreshCellClasses(): void;
  scheduleSave(): void;
  clearCell(pos?: CellPosition | null): void;
  toggleStrike(pos?: CellPosition | null): void;
}

export interface CellKeyboardController {
  onCellKeyDown(event: KeyboardEvent): void;
  acceptSuggestion(value: string): void;
}

export function createCellKeyboardController({
  selection,
  getState,
  getCellElement,
  autocomplete,
  clearRowSelection,
  setSingleSelection,
  cancelTransientUi,
  refreshCellClasses,
  scheduleSave,
  clearCell,
  toggleStrike
}: CellKeyboardControllerOptions): CellKeyboardController {
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

  function acceptSuggestion(value: string): void {
    const pos = autocomplete.active.pos || selection.getSelectedCell();
    if (!pos) return;
    const cell = getState().rows[pos.row].cells[pos.cycle];
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

  function focusRelativeCell(pos: CellPosition, offset: number): void {
    const state = getState();
    const total = state.rows.length * state.cycles;
    if (total === 0) return;
    const flat = pos.row * state.cycles + pos.cycle;
    const next = Math.max(0, Math.min(total - 1, flat + offset));
    focusCell(Math.floor(next / state.cycles), next % state.cycles);
  }

  function focusCell(row: number, cycle: number): void {
    const state = getState();
    if (row < 0 || row >= state.rows.length || cycle < 0 || cycle >= state.cycles) return;
    const input = getCellElement({ row, cycle });
    if (input) {
      clearRowSelection();
      input.focus();
      input.select();
      setSingleSelection({ row, cycle });
    }
  }

  return { onCellKeyDown, acceptSuggestion };
}

