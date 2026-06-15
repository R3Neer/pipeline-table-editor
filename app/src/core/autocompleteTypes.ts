import type { AppState, CellPosition } from "./model";
import type { parseStageText } from "./stage";

export interface SuggestionCandidate {
  value: string;
  priority: number;
  order: number;
  exactValidInput: boolean;
}

export interface AutocompleteContext {
  state: AppState;
  pos: CellPosition;
  normalizedInput: string;
  input: string;
  mustPlacePending: boolean;
  canPlacePending: boolean;
  previousStage: ReturnType<typeof parseStageText>;
}

export type SuggestionProvider = (
  context: AutocompleteContext,
  add: (value: string, priority: number) => void
) => "stop" | void;

export interface RootPreference {
  numberedScore: number;
  bareScore: number;
  preferredNumber: number;
}

export interface LocalRootNumbering {
  usesNumbered: boolean;
  expectedNumber: number | null;
}

