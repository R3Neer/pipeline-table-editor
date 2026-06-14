import type { AppState, CellPosition, StageRoot } from "./model";
import { stageRoots } from "./model";
import { formatPendingStageText, formatStageText, normalizeCellText, parseStageText } from "./stage";
import { getStageOrder, isCellTextValid, requiresPendingFromAbove } from "./validation";

interface SuggestionCandidate {
  value: string;
  priority: number;
  order: number;
  exactValidInput: boolean;
}

interface AutocompleteContext {
  state: AppState;
  pos: CellPosition;
  normalizedInput: string;
  input: string;
  mustPlacePending: boolean;
  canPlacePending: boolean;
  previousStage: ReturnType<typeof parseStageText>;
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
  const normalizedInput = normalizeCellText(raw).trim();
  const context: AutocompleteContext = {
    state,
    pos,
    normalizedInput,
    input: normalizedInput.toUpperCase(),
    mustPlacePending: requiresPendingFromAbove(state, pos),
    canPlacePending: pos.cycle < state.cycles - 1,
    previousStage: parseStageText(pos.cycle > 0 ? state.rows[pos.row].cells[pos.cycle - 1].text.trim() : "")
  };
  const collector = createSuggestionCollector(context);

  addExactInputCandidate(context, collector.add);

  if (context.previousStage?.pending) {
    addPendingContinuationCandidates(context, collector.add);
    return orderSuggestions(collector.candidates, context.input).slice(0, maxSuggestions);
  }

  addHistoricalNextCandidates(context, collector.add);
  addNumberedContinuationCandidates(context, collector.add);

  const nextRoot = getNextStageRoot(state, pos);
  if (nextRoot) {
    addRootCandidates(context, nextRoot, 2, collector.add);
  }

  getAllowedRoots(state, pos).forEach((root) => {
    addRootCandidates(context, root, 10, collector.add);
  });

  return orderSuggestions(collector.candidates, context.input).slice(0, maxSuggestions);
}

function createSuggestionCollector(context: AutocompleteContext): {
  candidates: SuggestionCandidate[];
  add: (value: string, priority: number) => void;
} {
  const candidates: SuggestionCandidate[] = [];
  let order = 0;
  return {
    candidates,
    add(value: string, priority: number) {
      if (context.mustPlacePending && !value.endsWith("p")) return;
      if (!matchesInput(value, context.input)) return;
      candidates.push({
        value,
        priority,
        order,
        exactValidInput: isExactValidInput(value, context.normalizedInput, context.state, context.pos)
      });
      order += 1;
    }
  };
}

function addExactInputCandidate(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  if (context.normalizedInput && isAutocompleteValidInput(context.normalizedInput, context.state, context.pos)) {
    add(context.normalizedInput, -100);
  }
}

function addPendingContinuationCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  const previousStage = context.previousStage;
  if (!previousStage?.pending) return;

  if (context.mustPlacePending) {
    add(formatPendingStageText(previousStage.root, previousStage.number), 0);
    return;
  }

  add(formatStageText(previousStage.root, previousStage.number), 0);
  if (context.canPlacePending) add(formatPendingStageText(previousStage.root, previousStage.number), 1);
}

function addHistoricalNextCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  const nextStage = getHistoricalNextStage(context.state, context.pos);
  if (nextStage) add(nextStage, -1);
}

function addNumberedContinuationCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  const previousStage = context.previousStage;
  if (!previousStage?.number || previousStage.pending) return;

  add(formatStageText(previousStage.root, previousStage.number + 1), 0);
  if (context.canPlacePending) add(formatPendingStageText(previousStage.root, previousStage.number + 1), 1);
}

function addRootCandidates(
  context: AutocompleteContext,
  root: StageRoot,
  priority: number,
  add: (value: string, priority: number) => void
): void {
  const localContext = getLocalRootNumbering(context.state, context.pos, root);
  const preference = getRootPreference(context.state, root);
  const preferNumbered = localContext.usesNumbered || shouldPreferNumbered(root, preference);
  const preferredNumber = localContext.expectedNumber || 1;

  if (preferNumbered) {
    add(formatStageText(root, preferredNumber), priority);
    if (context.canPlacePending) add(formatPendingStageText(root, preferredNumber), priority + 1);
    if (
      localContext.usesNumbered &&
      canRecommendPreferredNumber(context.state, context.pos, root, preference.preferredNumber) &&
      preference.preferredNumber !== preferredNumber &&
      !context.mustPlacePending
    ) {
      add(formatStageText(root, preference.preferredNumber), priority + 2);
    }
    if (!localContext.usesNumbered) add(root, priority + 3);
    return;
  }

  add(root, priority);
  add(formatStageText(root, preferredNumber), priority + 3);
  if (context.canPlacePending) add(formatPendingStageText(root, null), priority + 4);
}

function orderSuggestions(candidates: SuggestionCandidate[], input: string): string[] {
  const unique = new Map<string, SuggestionCandidate>();
  candidates.forEach((candidate) => {
    const existing = unique.get(candidate.value);
    if (!existing || candidate.priority < existing.priority) unique.set(candidate.value, candidate);
  });

  return [...unique.values()]
    .sort((a, b) => {
      if (a.exactValidInput !== b.exactValidInput) return a.exactValidInput ? -1 : 1;
      const completionDiff = completionRank(a.value, input) - completionRank(b.value, input);
      if (completionDiff) return completionDiff;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.order - b.order;
    })
    .map((candidate) => candidate.value);
}

function isExactValidInput(value: string, input: string, state: AppState, pos: CellPosition): boolean {
  return Boolean(input && value === input && isAutocompleteValidInput(input, state, pos));
}

function isAutocompleteValidInput(value: string, state: AppState, pos: CellPosition): boolean {
  const parsed = parseStageText(value);
  if (!parsed || !isCellTextValidForSuggestion(value, state, pos)) return false;

  const localContext = getLocalRootNumbering(state, pos, parsed.root);
  if (localContext.usesNumbered && !parsed.number) return false;
  if (parsed.number && parsed.number > 1 && !hasPreviousNumberInRow(state, pos, parsed.root, parsed.number)) return false;
  return true;
}

function isCellTextValidForSuggestion(value: string, state: AppState, pos: CellPosition): boolean {
  const row = state.rows[pos.row];
  const cell = row?.cells[pos.cycle];
  if (!row || !cell) return false;
  const previousText = cell.text;
  cell.text = value;
  const valid = isCellTextValid(value, state, pos);
  cell.text = previousText;
  return valid;
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

function canRecommendPreferredNumber(state: AppState, pos: CellPosition, root: StageRoot, number: number): boolean {
  if (number <= 1) return true;
  return hasPreviousNumberInRow(state, pos, root, number);
}

function getHistoricalNextStage(state: AppState, pos: CellPosition): string | null {
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

function hasPreviousNumberInRow(state: AppState, pos: CellPosition, root: StageRoot, number: number): boolean {
  return state.rows[pos.row].cells.slice(0, pos.cycle).some((cell) => {
    const parsed = parseStageText(cell.text.trim());
    return parsed?.root === root && parsed.number === number - 1 && !parsed.pending;
  });
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
