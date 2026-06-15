import type { AppState, CellPosition, StageRoot } from "./model";
import { parseStageText } from "./stage";
import { isCellTextValid } from "./validation";
import { getLocalRootNumbering, hasPreviousNumberInRow } from "./autocompleteRowAnalysis";

export function isExactValidInput(value: string, input: string, state: AppState, pos: CellPosition): boolean {
  return Boolean(input && value === input && isAutocompleteValidInput(input, state, pos));
}

export function isAutocompleteValidInput(value: string, state: AppState, pos: CellPosition): boolean {
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
