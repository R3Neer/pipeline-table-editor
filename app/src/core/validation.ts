import type { AppState, CellPosition, PipelineArrow, StageRoot } from "./model";
import { stageRoots } from "./model";
import {
  formatPendingStageText,
  formatStageText,
  getStageOrder,
  getValidRoot,
  isPendingStageText,
  parseStageText,
  validCellPattern
} from "./stage";

export { getStageOrder, getValidRoot, isPendingStageText, normalizeCellText, validCellPattern } from "./stage";

export function isCellTextValid(value: string, state: AppState, pos: CellPosition): boolean {
  if (!value) return true;
  if (!validCellPattern.test(value)) return false;
  if (requiresPendingFromAbove(state, pos) && !isPendingStageText(value)) return false;
  if (isOutOfStageOrder(value, state, pos)) return false;
  if (isMissingPreviousStage(value, state, pos)) return false;

  const pendingStage = parseStageText(value);
  if (!pendingStage?.pending) return true;

  if (!resolvesPendingChain(state, pos)) return false;

  if (!pendingStage.number) return true;
  const previous = pos.cycle > 0 ? state.rows[pos.row].cells[pos.cycle - 1].text.trim() : "";
  if (previous === formatPendingStageText(pendingStage.root, pendingStage.number)) return true;

  return previous === formatStageText(pendingStage.root, pendingStage.number - 1);
}

function resolvesPendingChain(state: AppState, pos: CellPosition): boolean {
  const pendingStage = parseStageText(state.rows[pos.row].cells[pos.cycle].text);
  if (!pendingStage?.pending) return true;

  const expectedStage = formatStageText(pendingStage.root, pendingStage.number);
  const expectedPending = formatPendingStageText(pendingStage.root, pendingStage.number);
  for (let cycle = pos.cycle + 1; cycle < state.cycles; cycle += 1) {
    const nextText = state.rows[pos.row].cells[cycle].text.trim();
    if (!nextText) return true;
    if (nextText === expectedStage) return true;
    if (nextText === expectedPending) continue;
    return false;
  }

  return true;
}

export function requiresPendingFromAbove(state: AppState, pos: CellPosition): boolean {
  for (let row = pos.row - 1; row >= 0; row -= 1) {
    const text = state.rows[row].cells[pos.cycle].text.trim();
    if (!text) return false;
    if (isPendingStageText(text)) return true;
  }

  return false;
}

function isOutOfStageOrder(value: string, state: AppState, pos: CellPosition): boolean {
  const root = getValidRoot(value);
  if (!root) return false;

  const currentOrder = getStageOrder(root);
  for (let cycle = pos.cycle - 1; cycle >= 0; cycle -= 1) {
    const previousText = state.rows[pos.row].cells[cycle].text.trim();
    const previousRoot = getValidRoot(previousText);
    if (!previousRoot || !validCellPattern.test(previousText)) continue;
    return currentOrder < getStageOrder(previousRoot);
  }

  return false;
}

function isMissingPreviousStage(value: string, state: AppState, pos: CellPosition): boolean {
  const root = getValidRoot(value);
  if (!root || root === "IF") return false;

  const requiredPreviousRoot = stageRoots[getStageOrder(root) - 1];
  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const previousText = state.rows[pos.row].cells[cycle].text.trim();
    const previousRoot = getValidRoot(previousText);
    if (previousRoot === requiredPreviousRoot && validCellPattern.test(previousText)) return false;
  }

  return true;
}

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
  state: AppState
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
      to.cycle > from.cycle
  );
}

export function remapMovedRow(pos: CellPosition, from: number, to: number): CellPosition {
  if (pos.row === from) return { ...pos, row: to };
  if (from < to && pos.row > from && pos.row <= to) return { ...pos, row: pos.row - 1 };
  if (from > to && pos.row >= to && pos.row < from) return { ...pos, row: pos.row + 1 };
  return pos;
}
