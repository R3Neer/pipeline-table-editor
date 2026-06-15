import type { AppState, CellPosition } from "./model";
import { normalizeCellText, parseStageText } from "./stage";
import { requiresPendingFromAbove } from "./validation";
import { defaultSuggestionProviders } from "./autocompleteProviders";
import { matchesInput, orderSuggestions } from "./autocompleteRanking";
import type { AutocompleteContext, SuggestionCandidate, SuggestionProvider } from "./autocompleteTypes";
import { isExactValidInput } from "./autocompleteValidation";

const maxSuggestions = 8;

export { defaultSuggestionProviders };
export type { AutocompleteContext, SuggestionProvider };

export function getAutocompleteSuggestions(
  state: AppState,
  pos: CellPosition,
  raw: string,
  providers: SuggestionProvider[] = defaultSuggestionProviders
): string[] {
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

  for (const provider of providers) {
    const result = provider(context, collector.add);
    if (result === "stop") break;
  }

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

