import type { AppState, CellPosition, StageRoot } from "./model";
import { stageRoots } from "./model";
import {
  formatPendingStageText,
  formatStageText,
  getStageOrder,
  getValidRoot,
  isPendingStageText,
  parseStageText,
  validCellPattern
} from "./stage";

export { getStageOrder, getValidRoot, isPendingStageText, normalizeCellText, validCellPattern } from "./stage";

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

export const defaultCellValidationRules: CellValidationRule[] = [
  {
    id: "stage-format",
    isValid: ({ value }) => validCellPattern.test(value)
  },
  {
    id: "pending-required-from-above",
    isValid: ({ value, state, pos }) => !requiresPendingFromAbove(state, pos) || isPendingStageText(value)
  },
  {
    id: "stage-order",
    isValid: ({ value, state, pos }) => !isOutOfStageOrder(value, state, pos)
  },
  {
    id: "required-previous-stage",
    isValid: ({ value, state, pos }, validate) => !isMissingPreviousStage(value, state, pos, validate)
  },
  {
    id: "pending-chain-resolution",
    isValid: ({ state, pos }) => resolvesPendingChain(state, pos)
  },
  {
    id: "pending-number-sequence",
    isValid: ({ value, state, pos }) => hasValidPendingNumberSequence(value, state, pos)
  }
];

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

function resolvesPendingChain(state: AppState, pos: CellPosition): boolean {
  const pendingStage = parseStageText(state.rows[pos.row].cells[pos.cycle].text);
  if (!pendingStage?.pending) return true;

  const expectedStage = formatStageText(pendingStage.root, pendingStage.number);
  const expectedPending = formatPendingStageText(pendingStage.root, pendingStage.number);
  for (let cycle = pos.cycle + 1; cycle < state.cycles; cycle += 1) {
    const nextText = state.rows[pos.row].cells[cycle].text.trim();
    if (!nextText) return true;
    if (nextText === expectedStage) return true;
    if (nextText === expectedPending) continue;
    return false;
  }

  return true;
}

export function requiresPendingFromAbove(state: AppState, pos: CellPosition): boolean {
  for (let row = pos.row - 1; row >= 0; row -= 1) {
    const text = state.rows[row].cells[pos.cycle].text.trim();
    if (!text) return false;
    if (isPendingStageText(text)) return true;
  }

  return false;
}

function isOutOfStageOrder(value: string, state: AppState, pos: CellPosition): boolean {
  const root = getValidRoot(value);
  if (!root) return false;

  const currentOrder = getStageOrder(root);
  for (let cycle = pos.cycle - 1; cycle >= 0; cycle -= 1) {
    const previousText = state.rows[pos.row].cells[cycle].text.trim();
    const previousRoot = getValidRoot(previousText);
    if (!previousRoot || !validCellPattern.test(previousText)) continue;
    return currentOrder < getStageOrder(previousRoot);
  }

  return false;
}

function isMissingPreviousStage(value: string, state: AppState, pos: CellPosition, validate: CellValidator): boolean {
  const root = getValidRoot(value);
  if (!root || root === "IF") return false;

  const requiredPreviousRoot = stageRoots[getStageOrder(root) - 1];
  for (let cycle = 0; cycle < pos.cycle; cycle += 1) {
    const previousText = state.rows[pos.row].cells[cycle].text.trim();
    const previousRoot = getValidRoot(previousText);
    if (previousRoot === requiredPreviousRoot && isPreviousCellValid(previousText, state, { row: pos.row, cycle }, validate)) {
      return false;
    }
  }

  return true;
}

function isPreviousCellValid(value: string, state: AppState, pos: CellPosition, validate: CellValidator): boolean {
  return validCellPattern.test(value) && validate(value, state, pos);
}

function hasValidPendingNumberSequence(value: string, state: AppState, pos: CellPosition): boolean {
  const pendingStage = parseStageText(value);
  if (!pendingStage?.pending) return true;
  if (!pendingStage.number) return true;
  if (pendingStage.number === 1) return true;
  const previous = pos.cycle > 0 ? state.rows[pos.row].cells[pos.cycle - 1].text.trim() : "";
  if (previous === formatPendingStageText(pendingStage.root, pendingStage.number)) return true;
  return previous === formatStageText(pendingStage.root, pendingStage.number - 1);
}
