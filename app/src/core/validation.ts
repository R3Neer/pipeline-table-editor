import type { AppState, CellPosition } from "./model";
import { defaultCellValidationRules } from "./validationRules";
import type { CellValidationResult, CellValidationRule, CellValidator } from "./validationTypes";

export { getStageOrder, getValidRoot, isPendingStageText, normalizeCellText, validCellPattern } from "./stage";
export { defaultCellValidationRules, requiresPendingFromAbove } from "./validationRules";
export type { CellValidationContext, CellValidationResult, CellValidationRule, CellValidator } from "./validationTypes";

export function createCellValidator(rules: CellValidationRule[] = defaultCellValidationRules): {
  validate: (value: string, state: AppState, pos: CellPosition) => CellValidationResult;
  isValid: CellValidator;
} {
  return {
    validate(value: string, state: AppState, pos: CellPosition): CellValidationResult {
      return validateCellText(value, state, pos, rules);
    },
    isValid(value: string, state: AppState, pos: CellPosition): boolean {
      return validateCellText(value, state, pos, rules).valid;
    }
  };
}

export function validateCellText(
  value: string,
  state: AppState,
  pos: CellPosition,
  rules: CellValidationRule[] = defaultCellValidationRules
): CellValidationResult {
  if (!value) return { valid: true, failedRule: null };
  const validate: CellValidator = (nextValue, nextState, nextPos) =>
    validateCellText(nextValue, nextState, nextPos, rules).valid;
  const context = { value, state, pos };
  const failedRule = rules.find((rule) => !rule.isValid(context, validate))?.id || null;
  return { valid: !failedRule, failedRule };
}

export function isCellTextValid(value: string, state: AppState, pos: CellPosition): boolean {
  return validateCellText(value, state, pos).valid;
}
