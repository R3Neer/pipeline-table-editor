import type { AppState, CellPosition, StageRoot } from "./model";
import { parseStageText } from "./stage";
import type { LocalRootNumbering } from "./autocompleteTypes";

export function getLocalRootNumbering(state: AppState, pos: CellPosition, root: StageRoot): LocalRootNumbering {
  let usesNumbered = false;
  let maxNumber = 0;
  let previousSameRootNumber: number | null = null;
  let previousSameRootPending = false;

  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (!parsed || parsed.root !== root) continue;
    if (parsed.number) {
      usesNumbered = true;
      maxNumber = Math.max(maxNumber, parsed.number);
    }
    if (cycle === pos.cycle - 1) {
      previousSameRootNumber = parsed.number;
      previousSameRootPending = parsed.pending;
    }
  }

  if (!usesNumbered) return { usesNumbered, expectedNumber: null };
  if (previousSameRootPending) return { usesNumbered, expectedNumber: previousSameRootNumber };
  if (previousSameRootNumber) return { usesNumbered, expectedNumber: previousSameRootNumber + 1 };
  return { usesNumbered, expectedNumber: maxNumber + 1 };
}

export function hasPreviousNumberInRow(state: AppState, pos: CellPosition, root: StageRoot, number: number): boolean {
  return state.rows[pos.row].cells.slice(0, pos.cycle).some((cell) => {
    const parsed = parseStageText(cell.text.trim());
    return parsed?.root === root && parsed.number === number - 1 && !parsed.pending;
  });
}
