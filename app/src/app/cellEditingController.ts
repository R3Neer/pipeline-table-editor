import { samePos } from "../core/arrows";
import type { AppState, CellPosition } from "../core/model";
import { normalizeCellText } from "../core/validation";
import { getInputPosition } from "../ui/dom";
import type { CopiedCell } from "./sessionTypes";
import type { SelectionController } from "./selectionController";

export interface CellEditingController {
  onCellInput(event: Event): void;
  onCellFocus(event: FocusEvent): void;
  onCellClick(event: MouseEvent): void;
  onCellMouseEnter(event: MouseEvent): void;
  onCellMouseLeave(event: MouseEvent): void;
  onCellContextMenu(event: MouseEvent): void;
  onCellKeyDown(event: KeyboardEvent): void;
  acceptSuggestion(value: string): void;
  hideAutocompleteIfFocusLeftCells(): void;
  toggleStrike(pos?: CellPosition | null): void;
  clearCell(pos?: CellPosition | null): void;
  copyCell(pos?: CellPosition | null): void;
  cutCell(pos?: CellPosition | null): void;
  pasteCell(pos?: CellPosition | null): void;
}

interface CellEditingControllerOptions {
  selection: SelectionController;
  getState(): AppState;
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  autocomplete: {
    active: { pos: CellPosition | null; values: string[]; index: number };
    show(input: HTMLInputElement, pos: CellPosition, state: AppState): void;
    hide(): void;
    move(direction: number): void;
  };
  arrowExpansion: {
    getExpandFrom(): CellPosition | null;
    getArrowFrom(): CellPosition | null;
    tryExpandTo(to: CellPosition): Promise<void>;
    tryCreateArrowTo(to: CellPosition): void;
    setArrowHoverTarget(pos: CellPosition): void;
    clearArrowHoverTargetIfMatches(pos: CellPosition): void;
  };
  contextMenu: {
    hideCellMenu(): void;
    openCellMenu(pos: CellPosition, x: number, y: number): void;
  };
  clearRowSelection(): void;
  setSingleSelection(pos: CellPosition): void;
  updateSelectionFromClick(pos: CellPosition, event: MouseEvent): void;
  renderSelectionInfo(): void;
  cancelTransientUi(): void;
  refreshCellClasses(): void;
  scheduleSave(): void;
  drawArrows(): void;
  removeOutgoingArrows(pos: CellPosition): boolean;
}

export function createCellEditingController({
  selection,
  getState,
  getCellElement,
  autocomplete,
  arrowExpansion,
  contextMenu,
  clearRowSelection,
  setSingleSelection,
  updateSelectionFromClick,
  renderSelectionInfo,
  cancelTransientUi,
  refreshCellClasses,
  scheduleSave,
  drawArrows,
  removeOutgoingArrows
}: CellEditingControllerOptions): CellEditingController {
  let copiedCell: CopiedCell | null = null;

  function onCellInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const pos = getInputPosition(input);
    const normalized = normalizeCellText(input.value);
    const state = getState();
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
    const selectedCell = getInputPosition(input);
    selection.setSelectedCell(selectedCell);
    if (!selection.hasSelectionAnchor()) setSingleSelection(selectedCell);
    contextMenu.hideCellMenu();
    refreshCellClasses();
    renderSelectionInfo();
    autocomplete.show(input, selectedCell, getState());
  }

  function onCellClick(event: MouseEvent): void {
    const input = event.currentTarget as HTMLInputElement;
    clearRowSelection();
    const selectedCell = getInputPosition(input);
    selection.setSelectedCell(selectedCell);
    contextMenu.hideCellMenu();
    const expandFrom = arrowExpansion.getExpandFrom();
    if (expandFrom && !samePos(expandFrom, selectedCell)) {
      void arrowExpansion.tryExpandTo(selectedCell);
      return;
    }
    if (arrowExpansion.getArrowFrom()) {
      arrowExpansion.tryCreateArrowTo(selectedCell);
      return;
    }
    updateSelectionFromClick(selectedCell, event);
    renderSelectionInfo();
    if (isSelectionModifierClick(event)) {
      autocomplete.hide();
      return;
    }
    autocomplete.show(input, selectedCell, getState());
  }

  function onCellMouseEnter(event: MouseEvent): void {
    arrowExpansion.setArrowHoverTarget(getInputPosition(event.currentTarget as HTMLInputElement));
  }

  function onCellMouseLeave(event: MouseEvent): void {
    arrowExpansion.clearArrowHoverTargetIfMatches(getInputPosition(event.currentTarget as HTMLInputElement));
  }

  function onCellContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    clearRowSelection();
    const contextCell = getInputPosition(input);
    selection.setSelectedCell(contextCell);
    if (!selection.hasSelectedCell(contextCell)) setSingleSelection(contextCell);
    refreshCellClasses();
    autocomplete.hide();
    contextMenu.openCellMenu(contextCell, event.clientX, event.clientY);
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

  function hideAutocompleteIfFocusLeftCells(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement && activeElement.classList.contains("stage-input")) return;
    autocomplete.hide();
  }

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
    autocomplete.hide();
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

  function isSelectionModifierClick(event: MouseEvent): boolean {
    return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  }

  return {
    onCellInput,
    onCellFocus,
    onCellClick,
    onCellMouseEnter,
    onCellMouseLeave,
    onCellContextMenu,
    onCellKeyDown,
    acceptSuggestion,
    hideAutocompleteIfFocusLeftCells,
    toggleStrike,
    clearCell,
    copyCell,
    cutCell,
    pasteCell
  };
}
