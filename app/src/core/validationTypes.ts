import type { AppState, CellPosition } from "./model";

export interface CellValidationContext {
  value: string;
  state: AppState;
  pos: CellPosition;
}

export interface CellValidationRule {
  id: string;
  isValid(context: CellValidationContext, validate: CellValidator): boolean;
}

export interface CellValidationResult {
  valid: boolean;
  failedRule: string | null;
}

export type CellValidator = (value: string, state: AppState, pos: CellPosition) => boolean;
