import type { AppState, CellPosition } from "../../core/model";
import type { SelectionController } from "../selection/selectionController";

interface SelectionUiControllerOptions {
  selection: SelectionController;
  getState(): AppState;
  refreshCellClasses(): void;
  refreshRowSelectionClasses(): void;
}

export interface SelectionUiController {
  updateSelectionFromClick(pos: CellPosition, event: MouseEvent): void;
  setSingleSelection(pos: CellPosition): void;
  clearSelection(): void;
  clearRowSelection(): void;
  clearCellSelection(): void;
  setSingleRowSelection(rowIndex: number): void;
  updateRowSelectionFromClick(rowIndex: number, event: MouseEvent): void;
  getSelectedPositions(): CellPosition[];
  isMultiSelection(): boolean;
}

export function createSelectionUiController({
  selection,
  getState,
  refreshCellClasses,
  refreshRowSelectionClasses
}: SelectionUiControllerOptions): SelectionUiController {
  function updateSelectionFromClick(pos: CellPosition, event: MouseEvent): void {
    selection.updateSelectionFromClick(pos, event);
  }

  function setSingleSelection(pos: CellPosition): void {
    selection.setSingleSelection(pos);
    refreshRowSelectionClasses();
  }

  function clearSelection(): void {
    selection.clearSelection();
  }

  function clearRowSelection(): void {
    selection.clearRowSelection();
    refreshRowSelectionClasses();
  }

  function clearCellSelection(): void {
    selection.clearCellSelection();
    refreshCellClasses();
  }

  function setSingleRowSelection(rowIndex: number): void {
    selection.setSingleRowSelection(rowIndex);
    refreshCellClasses();
    refreshRowSelectionClasses();
  }

  function updateRowSelectionFromClick(rowIndex: number, event: MouseEvent): void {
    selection.updateRowSelectionFromClick(rowIndex, event);
    refreshCellClasses();
    refreshRowSelectionClasses();
  }

  function getSelectedPositions(): CellPosition[] {
    return selection.getSelectedPositions(getState());
  }

  function isMultiSelection(): boolean {
    return selection.isMultiSelection();
  }

  return {
    updateSelectionFromClick,
    setSingleSelection,
    clearSelection,
    clearRowSelection,
    clearCellSelection,
    setSingleRowSelection,
    updateRowSelectionFromClick,
    getSelectedPositions,
    isMultiSelection
  };
}

