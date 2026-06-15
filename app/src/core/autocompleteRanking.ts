import { stageRoots } from "./model";
import type { SuggestionCandidate } from "./autocompleteTypes";

export function orderSuggestions(candidates: SuggestionCandidate[], input: string): string[] {
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

export function matchesInput(value: string, input: string): boolean {
  if (!input || value.toUpperCase().startsWith(input)) return true;
  if (hasNumericStageSuffix(input)) return false;
  return input.startsWith(getRootPrefix(value));
}

function completionRank(value: string, input: string): number {
  const normalizedValue = value.toUpperCase();
  if (!input) return 0;
  if (normalizedValue.startsWith(input) && normalizedValue !== input) return 0;
  if (normalizedValue === input) return 1;
  return 2;
}

function getRootPrefix(value: string): string {
  return stageRoots.find((root) => value.startsWith(root)) || value;
}

function hasNumericStageSuffix(input: string): boolean {
  return stageRoots.some((root) => input.startsWith(root) && /^\d/.test(input.slice(root.length)));
}

