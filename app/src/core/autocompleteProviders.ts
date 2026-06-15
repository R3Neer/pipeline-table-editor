import type { StageRoot } from "./model";
import { formatPendingStageText, formatStageText } from "./stage";
import type { AutocompleteContext, SuggestionProvider } from "./autocompleteTypes";
import {
  canRecommendPreferredNumber,
  getAllowedRoots,
  getNextStageRoot,
  getRootPreference,
  shouldPreferNumbered
} from "./autocompleteContext";
import { getHistoricalNextStage } from "./autocompleteHistory";
import { getLocalRootNumbering } from "./autocompleteRowAnalysis";
import { isAutocompleteValidInput } from "./autocompleteValidation";

export const defaultSuggestionProviders: SuggestionProvider[] = [
  addExactInputCandidates,
  addPendingContinuationCandidates,
  addHistoricalNextCandidates,
  addNumberedContinuationCandidates,
  addNextStageRootCandidates,
  addAllowedRootCandidates
];

function addExactInputCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  if (context.normalizedInput && isAutocompleteValidInput(context.normalizedInput, context.state, context.pos)) {
    add(context.normalizedInput, -100);
  }
}

function addPendingContinuationCandidates(
  context: AutocompleteContext,
  add: (value: string, priority: number) => void
): "stop" | void {
  const previousStage = context.previousStage;
  if (!previousStage?.pending) return;

  if (context.mustPlacePending) {
    add(formatPendingStageText(previousStage.root, previousStage.number), 0);
    return "stop";
  }

  add(formatStageText(previousStage.root, previousStage.number), 0);
  if (context.canPlacePending) add(formatPendingStageText(previousStage.root, previousStage.number), 1);
  return "stop";
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

function addNextStageRootCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  const nextRoot = getNextStageRoot(context.state, context.pos);
  if (nextRoot) addRootCandidates(context, nextRoot, 2, add);
}

function addAllowedRootCandidates(context: AutocompleteContext, add: (value: string, priority: number) => void): void {
  getAllowedRoots(context.state, context.pos).forEach((root) => {
    addRootCandidates(context, root, 10, add);
  });
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
