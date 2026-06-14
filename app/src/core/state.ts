import type { AppState, CellData, InstructionRow, PipelineArrow } from "./model";
import { isUsableArrow, isValidArrowTarget } from "./arrows";
import { normalizeCellText } from "./stage";

const STORAGE_KEY = "pipeline-table-editor-state-v2";
const LEGACY_STORAGE_KEY = "pipeline-table-editor-state-v1";

export function createDefaultState(): AppState {
  return {
    title: "Exercise 1",
    cycles: 10,
    rows: [
      makeRow("flw f10, 0(x1)", 10),
      makeRow("fmul.s f4, f0, f10", 10)
    ],
    arrows: []
  };
}

export function makeRow(instruction: string, cycles: number): InstructionRow {
  return {
    instruction,
    cells: Array.from({ length: cycles }, () => ({ text: "", struck: false }))
  };
}

export function loadState(): AppState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored) as Partial<AppState>) : null;
  } catch (error) {
    console.warn("Could not load localStorage", error);
    return null;
  }
}

export function saveStateToStorage(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeState(raw: Partial<AppState>): AppState {
  const cycles = Math.max(1, Number.parseInt(String(raw.cycles), 10) || 1);
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const arrows = normalizeArrows(raw.arrows);
  const normalized: AppState = {
    title: String(raw.title || ""),
    cycles,
    rows: rows.map((row) => normalizeRow(row, cycles)),
    arrows: []
  };

  arrows.forEach((arrow) => {
    if (isValidArrowTarget(arrow.from, arrow.to, normalized)) normalized.arrows.push(arrow);
  });
  return normalized;
}

function normalizeRow(row: Partial<InstructionRow>, cycles: number): InstructionRow {
  const cells = Array.isArray(row.cells) ? row.cells : [];
  return {
    instruction: String(row.instruction || ""),
    cells: Array.from({ length: cycles }, (_, index) => normalizeCell(cells[index]))
  };
}

function normalizeCell(cell: Partial<CellData> | undefined): CellData {
  return {
    text: normalizeCellText(String(cell?.text || "")),
    struck: Boolean(cell?.struck)
  };
}

function normalizeArrows(raw: unknown): PipelineArrow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isUsableArrow).map((arrow) => ({
    from: { row: arrow.from.row, cycle: arrow.from.cycle },
    to: { row: arrow.to.row, cycle: arrow.to.cycle },
    label: String(arrow.label || "")
  }));
}
