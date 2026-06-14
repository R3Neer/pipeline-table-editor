import { samePos } from "../arrows";
import type { AppState, CellPosition } from "../model";
import { makeRow } from "../state";

export function applyInstructionText(state: AppState, text: string): void {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  state.rows = lines.map((instruction, index) => {
    const previous = state.rows[index];
    if (!previous) return makeRow(instruction, state.cycles);
    return {
      instruction,
      cells: Array.from({ length: state.cycles }, (_, cellIndex) => previous.cells[cellIndex] || { text: "", struck: false }),
      label: previous.label,
      separatorBefore: previous.separatorBefore
    };
  });
  state.arrows = state.arrows.filter((arrow) => arrow.from.row < state.rows.length && arrow.to.row < state.rows.length);
}

export function changeCycleCount(state: AppState, nextCycles: number): void {
  state.cycles = nextCycles;
  state.rows.forEach((row) => {
    if (row.cells.length > nextCycles) row.cells = row.cells.slice(0, nextCycles);
    while (row.cells.length < nextCycles) row.cells.push({ text: "", struck: false });
  });
  state.arrows = state.arrows.filter((arrow) => arrow.from.cycle < nextCycles && arrow.to.cycle < nextCycles);
}

export function wouldLoseCellsAfterCycleReduction(state: AppState, nextCycles: number): boolean {
  return state.rows.some((row) => row.cells.slice(nextCycles).some((cell) => cell.text.trim() || cell.struck));
}

export function removeOutgoingArrows(state: AppState, pos: CellPosition): boolean {
  const before = state.arrows.length;
  state.arrows = state.arrows.filter((arrow) => !samePos(arrow.from, pos));
  return state.arrows.length !== before;
}

export function pruneArrowsFromStruckCells(state: AppState): boolean {
  const before = state.arrows.length;
  state.arrows = state.arrows.filter((arrow) => !state.rows[arrow.from.row]?.cells[arrow.from.cycle]?.struck);
  return state.arrows.length !== before;
}
