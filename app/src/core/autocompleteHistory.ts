import type { AppState, CellPosition } from "./model";
import { formatStageText, parseStageText } from "./stage";
import { isAutocompleteValidInput } from "./autocompleteValidation";

export function getHistoricalNextStage(state: AppState, pos: CellPosition): string | null {
  const previousStage = pos.cycle > 0 ? parseStageText(state.rows[pos.row].cells[pos.cycle - 1].text.trim()) : null;
  if (!previousStage || previousStage.pending) return null;

  const counts = new Map<string, number>();
  for (let rowIndex = 0; rowIndex < pos.row; rowIndex += 1) {
    const row = state.rows[rowIndex];
    for (let cycle = 0; cycle < row.cells.length - 1; cycle += 1) {
      const parsed = parseStageText(row.cells[cycle].text.trim());
      if (!isSameConcreteStage(parsed, previousStage)) continue;
      const next = getNextConcreteStageText(row.cells.slice(cycle + 1).map((cell) => cell.text));
      if (!next || !isAutocompleteValidInput(next, state, pos)) continue;
      counts.set(next, (counts.get(next) || 0) + 1);
    }
  }

  return getMostCommonText(counts);
}

function isSameConcreteStage(
  left: ReturnType<typeof parseStageText>,
  right: NonNullable<ReturnType<typeof parseStageText>>
): boolean {
  return Boolean(left && left.root === right.root && left.number === right.number && left.pending === right.pending);
}

function getNextConcreteStageText(texts: string[]): string | null {
  for (const text of texts) {
    const parsed = parseStageText(text.trim());
    if (!parsed) continue;
    return formatStageText(parsed.root, parsed.number);
  }
  return null;
}

function getMostCommonText(counts: Map<string, number>): string | null {
  let bestText: string | null = null;
  let bestCount = 0;
  counts.forEach((count, text) => {
    if (count > bestCount) {
      bestText = text;
      bestCount = count;
    }
  });
  return bestText;
}

