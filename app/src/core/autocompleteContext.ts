import type { AppState, CellPosition, StageRoot } from "./model";
import { stageRoots } from "./model";
import { parseStageText } from "./stage";
import { getStageOrder } from "./validation";
import type { RootPreference } from "./autocompleteTypes";
import { hasPreviousNumberInRow } from "./autocompleteRowAnalysis";

export function getNextStageRoot(state: AppState, pos: CellPosition): StageRoot | null {
  for (let cycle = pos.cycle - 1; cycle >= 0; cycle -= 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (!parsed) continue;
    const nextIndex = getStageOrder(parsed.root) + 1;
    return stageRoots[nextIndex] || null;
  }
  return stageRoots[0];
}

export function getAllowedRoots(state: AppState, pos: CellPosition): StageRoot[] {
  let lastRoot: StageRoot | null = null;
  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (parsed) lastRoot = parsed.root;
  }

  if (!lastRoot) return [stageRoots[0]];
  const lastOrder = getStageOrder(lastRoot);
  return stageRoots.slice(lastOrder, Math.min(stageRoots.length, lastOrder + 2));
}

export function getRootPreference(state: AppState, root: StageRoot): RootPreference {
  let numberedScore = 0;
  let bareScore = 0;
  const numberCounts = new Map<number, number>();

  state.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      const parsed = parseStageText(cell.text.trim());
      if (!parsed || parsed.root !== root || parsed.pending) return;
      if (parsed.number) {
        numberedScore = Math.min(3, numberedScore + 1);
        bareScore = Math.max(0, bareScore - 1);
        numberCounts.set(parsed.number, (numberCounts.get(parsed.number) || 0) + 1);
      } else {
        bareScore = Math.min(3, bareScore + 1);
        numberedScore = Math.max(0, numberedScore - 1);
      }
    });
  });

  return {
    numberedScore,
    bareScore,
    preferredNumber: getMostCommonNumber(numberCounts) || 1
  };
}

export function shouldPreferNumbered(root: StageRoot, preference: RootPreference): boolean {
  return root !== "EX" && preference.numberedScore >= Math.max(2, preference.bareScore + 1);
}

export function canRecommendPreferredNumber(state: AppState, pos: CellPosition, root: StageRoot, number: number): boolean {
  if (number <= 1) return true;
  return hasPreviousNumberInRow(state, pos, root, number);
}

function getMostCommonNumber(counts: Map<number, number>): number | null {
  let bestNumber: number | null = null;
  let bestCount = 0;
  counts.forEach((count, number) => {
    if (count > bestCount || (count === bestCount && bestNumber !== null && number < bestNumber)) {
      bestNumber = number;
      bestCount = count;
    }
  });
  return bestNumber;
}
