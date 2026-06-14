import type { AppState, CellPosition, StageRoot } from "./model";
import { stageRoots } from "./model";
import { formatPendingStageText, formatStageText, parseStageText } from "./stage";
import { getStageOrder, requiresPendingFromAbove } from "./validation";

interface SuggestionCandidate {
  value: string;
  priority: number;
  order: number;
}

interface RootPreference {
  numberedScore: number;
  bareScore: number;
  preferredNumber: number;
}

interface LocalRootNumbering {
  usesNumbered: boolean;
  expectedNumber: number | null;
}

const maxSuggestions = 8;

export function getAutocompleteSuggestions(state: AppState, pos: CellPosition, raw: string): string[] {
  const input = raw.trim().toUpperCase();
  const candidates: SuggestionCandidate[] = [];
  let order = 0;
  const mustPlacePending = requiresPendingFromAbove(state, pos);
  const add = (value: string, priority: number) => {
    if (mustPlacePending && !value.endsWith("p")) return;
    if (matchesInput(value, input)) {
      candidates.push({ value, priority, order });
      order += 1;
    }
  };

  const previous = pos.cycle > 0 ? state.rows[pos.row].cells[pos.cycle - 1].text.trim() : "";
  const previousStage = parseStageText(previous);
  const canPlacePending = pos.cycle < state.cycles - 1;
  const addRootCandidates = (root: StageRoot, priority: number) => {
    const localContext = getLocalRootNumbering(state, pos, root);
    const preference = getRootPreference(state, root);
    const preferNumbered = localContext.usesNumbered || shouldPreferNumbered(root, preference);
    const preferredNumber = localContext.expectedNumber || preference.preferredNumber;

    if (preferNumbered) {
      add(formatStageText(root, preferredNumber), priority);
      if (canPlacePending) add(formatPendingStageText(root, preferredNumber), priority + 1);
      if (localContext.usesNumbered && preference.preferredNumber !== preferredNumber && !mustPlacePending) {
        add(formatStageText(root, preference.preferredNumber), priority + 2);
      }
      if (!localContext.usesNumbered) add(root, priority + 3);
      return;
    }

    add(root, priority);
    add(formatStageText(root, preferredNumber), priority + 3);
    if (canPlacePending) add(formatPendingStageText(root, null), priority + 4);
  };

  if (previousStage?.pending) {
    if (mustPlacePending) {
      add(formatPendingStageText(previousStage.root, previousStage.number), 0);
    } else {
      add(formatStageText(previousStage.root, previousStage.number), 0);
      if (canPlacePending) add(formatPendingStageText(previousStage.root, previousStage.number), 1);
    }
    return orderSuggestions(candidates, input).slice(0, maxSuggestions);
  }

  if (previousStage?.number && !previousStage.pending) {
    add(formatStageText(previousStage.root, previousStage.number + 1), 0);
    if (canPlacePending) add(formatPendingStageText(previousStage.root, previousStage.number + 1), 1);
  }

  const nextRoot = getNextStageRoot(state, pos);
  if (nextRoot) {
    addRootCandidates(nextRoot, 2);
  }

  getAllowedRoots(state, pos).forEach((root) => {
    addRootCandidates(root, 10);
  });

  return orderSuggestions(candidates, input).slice(0, maxSuggestions);
}

function orderSuggestions(candidates: SuggestionCandidate[], input: string): string[] {
  const unique = new Map<string, SuggestionCandidate>();
  candidates.forEach((candidate) => {
    const existing = unique.get(candidate.value);
    if (!existing || candidate.priority < existing.priority) unique.set(candidate.value, candidate);
  });

  return [...unique.values()]
    .sort((a, b) => {
      const completionDiff = completionRank(a.value, input) - completionRank(b.value, input);
      if (completionDiff) return completionDiff;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.order - b.order;
    })
    .map((candidate) => candidate.value);
}

function completionRank(value: string, input: string): number {
  const normalizedValue = value.toUpperCase();
  if (!input) return 0;
  if (normalizedValue.startsWith(input) && normalizedValue !== input) return 0;
  if (normalizedValue === input) return 1;
  return 2;
}

function matchesInput(value: string, input: string): boolean {
  if (!input || value.toUpperCase().startsWith(input)) return true;
  if (hasNumericStageSuffix(input)) return false;
  return input.startsWith(getRootPrefix(value));
}

function getRootPrefix(value: string): string {
  return stageRoots.find((root) => value.startsWith(root)) || value;
}

function hasNumericStageSuffix(input: string): boolean {
  return stageRoots.some((root) => input.startsWith(root) && /^\d/.test(input.slice(root.length)));
}

function getNextStageRoot(state: AppState, pos: CellPosition): StageRoot | null {
  for (let cycle = pos.cycle - 1; cycle >= 0; cycle -= 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (!parsed) continue;
    const nextIndex = getStageOrder(parsed.root) + 1;
    return stageRoots[nextIndex] || null;
  }
  return stageRoots[0];
}

function getAllowedRoots(state: AppState, pos: CellPosition): StageRoot[] {
  let lastRoot: StageRoot | null = null;
  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (parsed) lastRoot = parsed.root;
  }

  if (!lastRoot) return [stageRoots[0]];
  const lastOrder = getStageOrder(lastRoot);
  return stageRoots.slice(lastOrder, Math.min(stageRoots.length, lastOrder + 2));
}

function getLocalRootNumbering(state: AppState, pos: CellPosition, root: StageRoot): LocalRootNumbering {
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

function getRootPreference(state: AppState, root: StageRoot): RootPreference {
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

function shouldPreferNumbered(root: StageRoot, preference: RootPreference): boolean {
  return root !== "EX" && preference.numberedScore >= Math.max(2, preference.bareScore + 1);
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
