import { isValidArrowTarget } from "./arrows";
import type { AppState } from "./model";

export function getRowActionTargets(selectedRows: Set<number>, fallback: number): number[] {
  return selectedRows.size > 1 && selectedRows.has(fallback) ? [...selectedRows] : [fallback];
}

export function isRowNonEmpty(state: AppState, rowIndex: number): boolean {
  const row = state.rows[rowIndex];
  if (!row) return false;
  return Boolean(
    row.instruction.trim() ||
      row.label ||
      row.separatorBefore ||
      row.cells.some((cell) => cell.text.trim() || cell.struck) ||
      state.arrows.some((arrow) => arrow.from.row === rowIndex || arrow.to.row === rowIndex)
  );
}

export function removeRows(state: AppState, rowIndexes: number[]): boolean {
  const targets = uniqueSortedRows(state, rowIndexes);
  if (!targets.length) return false;

  const removed = new Set(targets);
  const rowMap = new Map<number, number>();
  state.rows = state.rows.filter((_, index) => {
    if (removed.has(index)) return false;
    rowMap.set(index, rowMap.size);
    return true;
  });
  state.arrows = state.arrows
    .filter((arrow) => rowMap.has(arrow.from.row) && rowMap.has(arrow.to.row))
    .map((arrow) => ({
      ...arrow,
      from: { ...arrow.from, row: rowMap.get(arrow.from.row) ?? arrow.from.row },
      to: { ...arrow.to, row: rowMap.get(arrow.to.row) ?? arrow.to.row }
    }));

  return true;
}

export function moveRows(state: AppState, rowIndexes: number[], direction: number): Set<number> | null {
  const targets = new Set(uniqueSortedRows(state, rowIndexes));
  if (!targets.size) return null;

  const order = state.rows.map((_, index) => index);
  if (direction < 0) {
    for (let index = 1; index < order.length; index += 1) {
      if (targets.has(order[index]) && !targets.has(order[index - 1])) {
        [order[index - 1], order[index]] = [order[index], order[index - 1]];
      }
    }
  } else {
    for (let index = order.length - 2; index >= 0; index -= 1) {
      if (targets.has(order[index]) && !targets.has(order[index + 1])) {
        [order[index], order[index + 1]] = [order[index + 1], order[index]];
      }
    }
  }
  if (order.every((oldIndex, newIndex) => oldIndex === newIndex)) return null;

  return reorderRows(state, order, targets);
}

function reorderRows(state: AppState, order: number[], selectedOldRows: Set<number>): Set<number> {
  const rowMap = new Map<number, number>();
  state.rows = order.map((oldIndex, newIndex) => {
    rowMap.set(oldIndex, newIndex);
    return state.rows[oldIndex];
  });
  state.arrows = state.arrows
    .map((arrow) => ({
      ...arrow,
      from: { ...arrow.from, row: rowMap.get(arrow.from.row) ?? arrow.from.row },
      to: { ...arrow.to, row: rowMap.get(arrow.to.row) ?? arrow.to.row }
    }))
    .filter((arrow) => isValidArrowTarget(arrow.from, arrow.to, state, arrow));

  return new Set([...selectedOldRows].map((oldIndex) => rowMap.get(oldIndex)).filter((row): row is number => row !== undefined));
}

function uniqueSortedRows(state: AppState, rowIndexes: number[]): number[] {
  return [...new Set(rowIndexes)].filter((index) => index >= 0 && index < state.rows.length).sort((a, b) => a - b);
}
