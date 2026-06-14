import type { AppState, CellPosition, PipelineArrow } from "./model";

export function samePos(a: CellPosition | null | undefined, b: CellPosition | null | undefined): boolean {
  return Boolean(a && b && a.row === b.row && a.cycle === b.cycle);
}

export function isUsableArrow(arrow: unknown): arrow is PipelineArrow {
  const candidate = arrow as Partial<PipelineArrow> | null;
  return Boolean(
    candidate &&
      candidate.from &&
      candidate.to &&
      Number.isInteger(candidate.from.row) &&
      Number.isInteger(candidate.from.cycle) &&
      Number.isInteger(candidate.to.row) &&
      Number.isInteger(candidate.to.cycle)
  );
}

export function isValidArrowTarget(
  from: CellPosition | null | undefined,
  to: CellPosition | null | undefined,
  state: AppState,
  ignoredArrow?: PipelineArrow
): boolean {
  return Boolean(
    from &&
      to &&
      from.row >= 0 &&
      to.row >= 0 &&
      from.cycle >= 0 &&
      to.cycle >= 0 &&
      from.row < state.rows.length &&
      to.row < state.rows.length &&
      from.cycle < state.cycles &&
      to.cycle < state.cycles &&
      to.row > from.row &&
      to.cycle > from.cycle &&
      !state.arrows.some((arrow) => arrow !== ignoredArrow && samePos(arrow.to, to))
  );
}

export function remapMovedRow(pos: CellPosition, from: number, to: number): CellPosition {
  if (pos.row === from) return { ...pos, row: to };
  if (from < to && pos.row > from && pos.row <= to) return { ...pos, row: pos.row - 1 };
  if (from > to && pos.row >= to && pos.row < from) return { ...pos, row: pos.row + 1 };
  return pos;
}
