import { samePos } from "../core/arrows";
import type { AppState, CellPosition } from "../core/model";
import { normalizeCellText } from "../core/validation";
import { getInputPosition } from "../ui/dom";
import { createCellActionController } from "./cellActionController";
import { createCellKeyboardController } from "./cellKeyboardController";
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
  const actions = createCellActionController({
    selection,
    getState,
    getCellElement,
    hideAutocomplete: autocomplete.hide,
    refreshCellClasses,
    scheduleSave,
    drawArrows,
    removeOutgoingArrows
  });
  const keyboard = createCellKeyboardController({
    selection,
    getState,
    getCellElement,
    autocomplete,
    clearRowSelection,
    setSingleSelection,
    cancelTransientUi,
    refreshCellClasses,
    scheduleSave,
    clearCell: actions.clearCell,
    toggleStrike: actions.toggleStrike
  });

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

  function hideAutocompleteIfFocusLeftCells(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement && activeElement.classList.contains("stage-input")) return;
    autocomplete.hide();
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
    onCellKeyDown: keyboard.onCellKeyDown,
    acceptSuggestion: keyboard.acceptSuggestion,
    hideAutocompleteIfFocusLeftCells,
    toggleStrike: actions.toggleStrike,
    clearCell: actions.clearCell,
    copyCell: actions.copyCell,
    cutCell: actions.cutCell,
    pasteCell: actions.pasteCell
  };
}
