import type { AppState, CellPosition, StageRoot } from "../core/model";
import { stageRoots } from "../core/model";
import { parseStageText } from "../core/stage";
import { getStageOrder, requiresPendingFromAbove } from "../core/validation";

export interface ActiveSuggestion {
  pos: CellPosition | null;
  values: string[];
  index: number;
}

export const emptySuggestion: ActiveSuggestion = { pos: null, values: [], index: 0 };

export function createAutocompleteController(menu: HTMLElement) {
  let active: ActiveSuggestion = { ...emptySuggestion };

  return {
    get active() {
      return active;
    },
    show(input: HTMLInputElement, pos: CellPosition, state: AppState): void {
      const values = getSuggestions(state, pos, input.value);
      active = { pos: { ...pos }, values, index: 0 };
      if (!values.length) {
        this.hide();
        return;
      }

      const rect = input.getBoundingClientRect();
      menu.style.left = `${rect.left}px`;
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.width = `${Math.max(rect.width, 150)}px`;
      menu.replaceChildren(
        ...values.map((value, index) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = `autocomplete-option${index === 0 ? " active" : ""}`;
          option.textContent = value;
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            menu.dispatchEvent(new CustomEvent("autocomplete:accept", { detail: value }));
          });
          return option;
        })
      );
      menu.setAttribute("aria-hidden", "false");
    },
    hide(): void {
      active = { ...emptySuggestion };
      menu.setAttribute("aria-hidden", "true");
    },
    move(direction: number): void {
      const total = active.values.length;
      if (!total) return;
      active = {
        ...active,
        index: (active.index + direction + total) % total
      };
      menu.querySelectorAll(".autocomplete-option").forEach((option, index) => {
        option.classList.toggle("active", index === active.index);
      });
    }
  };
}

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

const maxSuggestions = 8;

function getSuggestions(state: AppState, pos: CellPosition, raw: string): string[] {
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

  if (previousStage?.pending) {
    add(`${previousStage.root}${previousStage.number || ""}`, 0);
  }

  if (previousStage?.number && !previousStage.pending) {
    add(`${previousStage.root}${previousStage.number + 1}`, 0);
    if (canPlacePending) add(`${previousStage.root}${previousStage.number + 1}p`, 1);
  }

  const nextRoot = getNextStageRoot(state, pos);
  if (nextRoot) {
    const preference = getRootPreference(state, nextRoot);
    if (shouldPreferNumbered(nextRoot, preference)) {
      add(`${nextRoot}${preference.preferredNumber}`, 2);
      add(nextRoot, 5);
    } else {
      add(nextRoot, 2);
      add(`${nextRoot}${preference.preferredNumber}`, 5);
    }
    if (canPlacePending) add(`${nextRoot}p`, 6);
  }

  getAllowedRoots(state, pos).forEach((root) => {
    const preference = getRootPreference(state, root);
    if (shouldPreferNumbered(root, preference)) {
      add(`${root}${preference.preferredNumber}`, 10);
      add(root, 12);
    } else {
      add(root, 10);
      add(`${root}${preference.preferredNumber}`, 12);
    }
    if (canPlacePending) add(`${root}p`, 13);
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
  if (!input) return 0;
  if (value.startsWith(input) && value !== input) return 0;
  if (value === input) return 1;
  return 2;
}

function matchesInput(value: string, input: string): boolean {
  return !input || value.startsWith(input) || input.startsWith(getRootPrefix(value));
}

function getRootPrefix(value: string): string {
  return stageRoots.find((root) => value.startsWith(root)) || value;
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
  const seenRoots = new Set<StageRoot>();
  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const parsed = parseStageText(state.rows[pos.row].cells[cycle].text.trim());
    if (parsed) seenRoots.add(parsed.root);
  }

  const allowed: StageRoot[] = [];
  for (const root of stageRoots) {
    const previousRoot = stageRoots[getStageOrder(root) - 1];
    if (!previousRoot || seenRoots.has(previousRoot) || seenRoots.has(root)) {
      allowed.push(root);
      continue;
    }
    break;
  }
  return allowed;
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
