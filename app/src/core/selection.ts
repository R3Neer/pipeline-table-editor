import type { CellPosition } from "./model";

export function positionKey(pos: CellPosition): string {
  return `${pos.row}:${pos.cycle}`;
}

export function parsePositionKey(key: string): CellPosition {
  const [row, cycle] = key.split(":").map(Number);
  return { row, cycle };
}

export function makeRectangularSelection(from: CellPosition, to: CellPosition): Set<string> {
  const keys = new Set<string>();
  const rowStart = Math.min(from.row, to.row);
  const rowEnd = Math.max(from.row, to.row);
  const cycleStart = Math.min(from.cycle, to.cycle);
  const cycleEnd = Math.max(from.cycle, to.cycle);
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let cycle = cycleStart; cycle <= cycleEnd; cycle += 1) {
      keys.add(positionKey({ row, cycle }));
    }
  }
  return keys;
}

export function makeVerticalSelection(from: CellPosition, to: CellPosition): Set<string> {
  const keys = new Set<string>();
  const rowStart = Math.min(from.row, to.row);
  const rowEnd = Math.max(from.row, to.row);
  for (let row = rowStart; row <= rowEnd; row += 1) {
    keys.add(positionKey({ row, cycle: to.cycle }));
  }
  return keys;
}
