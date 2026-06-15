import type { AppState, CellPosition } from "../../core/model";
import {
  makeRectangularSelection,
  makeVerticalSelection,
  parsePositionKey,
  positionKey
} from "../../core/selection";
import { getRowActionTargets as getSelectedRowTargets } from "../../core/rows";

interface SelectionClickModifiers {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface SelectionController {
  getSelectedCell(): CellPosition | null;
  setSelectedCell(pos: CellPosition | null): void;
  getSelectedCellKeys(): Set<string>;
  getSelectedRows(): Set<number>;
  hasSelectedCell(pos: CellPosition): boolean;
  hasSelectedRow(rowIndex: number): boolean;
  hasSelectionAnchor(): boolean;
  replaceRowSelection(rows: Set<number>): void;
  setSingleSelection(pos: CellPosition): void;
  clearSelection(): void;
  clearCellSelection(): void;
  clearRowSelection(): void;
  setSingleRowSelection(rowIndex: number): void;
  updateSelectionFromClick(pos: CellPosition, event: SelectionClickModifiers): void;
  updateRowSelectionFromClick(rowIndex: number, event: SelectionClickModifiers): void;
  getSelectedPositions(state: AppState): CellPosition[];
  getCellActionTargets(fallback: CellPosition, state: AppState): CellPosition[];
  isMultiSelection(): boolean;
  getRowActionTargets(fallback: number): number[];
}

export function createSelectionController(): SelectionController {
  let selectedCell: CellPosition | null = null;
  let selectionAnchor: CellPosition | null = null;
  let selectedCellKeys = new Set<string>();
  let selectedRows = new Set<number>();
  let rowSelectionAnchor: number | null = null;

  function getSelectedCell(): CellPosition | null {
    return selectedCell;
  }

  function setSelectedCell(pos: CellPosition | null): void {
    selectedCell = pos ? { ...pos } : null;
  }

  function getSelectedCellKeys(): Set<string> {
    return selectedCellKeys;
  }

  function getSelectedRows(): Set<number> {
    return selectedRows;
  }

  function hasSelectedRow(rowIndex: number): boolean {
    return selectedRows.has(rowIndex);
  }

  function hasSelectedCell(pos: CellPosition): boolean {
    return selectedCellKeys.has(positionKey(pos));
  }

  function hasSelectionAnchor(): boolean {
    return selectionAnchor !== null;
  }

  function replaceRowSelection(rows: Set<number>): void {
    selectedRows = rows;
    rowSelectionAnchor = selectedRows.size ? Math.min(...selectedRows) : null;
  }

  function setSingleSelection(pos: CellPosition): void {
    clearRowSelection();
    selectedCell = { ...pos };
    selectionAnchor = { ...pos };
    selectedCellKeys = new Set([positionKey(pos)]);
  }

  function clearSelection(): void {
    selectionAnchor = null;
    selectedCellKeys = new Set();
  }

  function clearRowSelection(): void {
    rowSelectionAnchor = null;
    selectedRows = new Set();
  }

  function clearCellSelection(): void {
    selectedCell = null;
    clearSelection();
  }

  function setSingleRowSelection(rowIndex: number): void {
    clearCellSelection();
    rowSelectionAnchor = rowIndex;
    selectedRows = new Set([rowIndex]);
  }

  function updateSelectionFromClick(pos: CellPosition, event: SelectionClickModifiers): void {
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

  function updateRowSelectionFromClick(rowIndex: number, event: SelectionClickModifiers): void {
    clearCellSelection();
    if (event.shiftKey && rowSelectionAnchor !== null) {
      const start = Math.min(rowSelectionAnchor, rowIndex);
      const end = Math.max(rowSelectionAnchor, rowIndex);
      selectedRows = new Set(Array.from({ length: end - start + 1 }, (_, offset) => start + offset));
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      selectedRows = new Set(selectedRows);
      if (selectedRows.has(rowIndex)) {
        selectedRows.delete(rowIndex);
      } else {
        selectedRows.add(rowIndex);
      }
      if (!selectedRows.size) selectedRows.add(rowIndex);
      rowSelectionAnchor ||= rowIndex;
      return;
    }

    setSingleRowSelection(rowIndex);
  }

  function getSelectedPositions(state: AppState): CellPosition[] {
    return [...selectedCellKeys]
      .map(parsePositionKey)
      .filter((pos) => Boolean(state.rows[pos.row]?.cells[pos.cycle]));
  }

  function getCellActionTargets(fallback: CellPosition, state: AppState): CellPosition[] {
    const positions = getSelectedPositions(state);
    return positions.length > 1 ? positions : [fallback];
  }

  function isMultiSelection(): boolean {
    return selectedCellKeys.size > 1;
  }

  function getRowActionTargets(fallback: number): number[] {
    return getSelectedRowTargets(selectedRows, fallback);
  }

  return {
    getSelectedCell,
    setSelectedCell,
    getSelectedCellKeys,
    getSelectedRows,
    hasSelectedCell,
    hasSelectedRow,
    hasSelectionAnchor,
    replaceRowSelection,
    setSingleSelection,
    clearSelection,
    clearCellSelection,
    clearRowSelection,
    setSingleRowSelection,
    updateSelectionFromClick,
    updateRowSelectionFromClick,
    getSelectedPositions,
    getCellActionTargets,
    isMultiSelection,
    getRowActionTargets
  };
}

