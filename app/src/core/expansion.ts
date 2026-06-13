import type { AppState, CellPosition, StageRoot } from "./model";
import { normalizeCellText } from "./stage";

interface ExpandableStage {
  root: StageRoot;
  startNumber: number;
  pending: boolean;
  normalized: string;
}

export function canStartExpand(state: AppState, pos: CellPosition): boolean {
  const cell = state.rows[pos.row].cells[pos.cycle];
  return !cell.struck && Boolean(parseExpandableStage(cell.text));
}

export function makeExpansionValues(state: AppState, from: CellPosition, to: CellPosition): string[] | null {
  const parsed = parseExpandableStage(state.rows[from.row].cells[from.cycle].text);
  if (!parsed) return null;

  const length = to.cycle - from.cycle + 1;
  if (parsed.pending) return Array.from({ length }, () => parsed.normalized);
  return Array.from({ length }, (_, index) => `${parsed.root}${parsed.startNumber + index}`);
}

export function wouldChangeFilledCells(state: AppState, from: CellPosition, values: string[]): boolean {
  return values.some((nextText, offset) => {
    const currentText = state.rows[from.row].cells[from.cycle + offset].text.trim();
    if (offset === 0 && currentText && `${currentText}1` === nextText) return false;
    return Boolean(currentText) && currentText !== nextText;
  });
}

function parseExpandableStage(raw: string): ExpandableStage | null {
  const normalized = normalizeCellText(raw).trim();
  const match = normalized.match(/^(IF|ID|EX|MEM|WB)(p|[1-9]\d*)?$/);
  if (!match) return null;

  const suffix = match[2] || "";
  return {
    root: match[1] as StageRoot,
    startNumber: suffix && suffix !== "p" ? Number(suffix) : 1,
    pending: suffix === "p",
    normalized
  };
}
