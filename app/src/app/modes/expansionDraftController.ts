import {
  canStartExpand as canStartExpandStage,
  makeExpansionValues,
  wouldChangeFilledCells
} from "../../core/expansion";
import type { AppState, CellPosition } from "../../core/model";
import type { AppMutationEffects } from "../appEffects";
import type { ExpandDraft } from "../sessionTypes";

interface ExpansionDraftContext {
  getState(): AppState;
  effects: Pick<AppMutationEffects, "renderAndSave">;
  showConfirm(title: string, message: string, acceptText?: string): Promise<boolean>;
}

interface ExpansionDraftOptions {
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  refreshCellClasses(): void;
  renderSelectionInfo(): void;
  cancelArrowDraft(): void;
  showInvalidTarget(): void;
}

export interface ExpansionDraftController {
  getExpandFrom(): CellPosition | null;
  startExpand(pos: CellPosition): void;
  tryExpandTo(to: CellPosition): Promise<void>;
  cancelExpandDraft(): void;
  canStartExpand(pos: CellPosition): boolean;
}

export function createExpansionDraftController(
  context: ExpansionDraftContext,
  options: ExpansionDraftOptions
): ExpansionDraftController {
  let expandDraft: ExpandDraft = { from: null };

  function getExpandFrom(): CellPosition | null {
    return expandDraft.from;
  }

  function startExpand(pos: CellPosition): void {
    if (!canStartExpand(pos)) return;
    options.cancelArrowDraft();
    expandDraft = { from: { ...pos } };
    options.refreshCellClasses();
    options.renderSelectionInfo();
  }

  async function tryExpandTo(to: CellPosition): Promise<void> {
    const from = expandDraft.from;
    if (!from) return;
    if (to.row !== from.row || to.cycle <= from.cycle) {
      options.showInvalidTarget();
      expandDraft = { from: null };
      options.refreshCellClasses();
      return;
    }

    const state = context.getState();
    const values = makeExpansionValues(state, from, to);
    if (!values) {
      expandDraft = { from: null };
      options.refreshCellClasses();
      return;
    }

    if (
      wouldChangeFilledCells(state, from, values) &&
      !(await context.showConfirm("Overwrite cells", "Expansion will overwrite filled cells. Continue?", "Overwrite"))
    ) {
      expandDraft = { from: null };
      options.refreshCellClasses();
      return;
    }

    values.forEach((text, offset) => {
      const cell = state.rows[from.row].cells[from.cycle + offset];
      cell.text = text;
      cell.struck = false;
      const input = options.getCellElement({ row: from.row, cycle: from.cycle + offset });
      if (input) input.value = text;
    });
    expandDraft = { from: null };
    context.effects.renderAndSave();
  }

  function cancelExpandDraft(): void {
    expandDraft = { from: null };
  }

  function canStartExpand(pos: CellPosition): boolean {
    return canStartExpandStage(context.getState(), pos);
  }

  return {
    getExpandFrom,
    startExpand,
    tryExpandTo,
    cancelExpandDraft,
    canStartExpand
  };
}

