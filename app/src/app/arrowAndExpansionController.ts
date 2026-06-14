import { isValidArrowTarget, samePos } from "../core/arrows";
import {
  canStartExpand as canStartExpandStage,
  makeExpansionValues,
  wouldChangeFilledCells
} from "../core/expansion";
import type { AppState, CellPosition } from "../core/model";
import { removeOutgoingArrows as removeOutgoingArrowsFromState } from "../core/useCases/tableEditing";
import { drawArrows as drawArrowLayer } from "../ui/arrows";
import type { AppElements } from "../ui/dom";
import type { ArrowDraft, ExpandDraft } from "./sessionTypes";

interface ArrowAndExpansionContext {
  elements: AppElements;
  getState(): AppState;
  render(): void;
  scheduleSave(): void;
  showStatus(message: string): void;
  showConfirm(title: string, message: string, acceptText?: string): Promise<boolean>;
}

interface ArrowAndExpansionOptions {
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  hideAutocomplete(): void;
  refreshCellClasses(): void;
  renderSelectionInfo(): void;
}

export interface ArrowAndExpansionController {
  getArrowFrom(): CellPosition | null;
  getArrowHoverTarget(): CellPosition | null;
  getExpandFrom(): CellPosition | null;
  startArrow(pos: CellPosition): void;
  tryCreateArrowTo(to: CellPosition): void;
  cancelArrowDraft(): void;
  startExpand(pos: CellPosition): void;
  tryExpandTo(to: CellPosition): Promise<void>;
  cancelExpandDraft(): void;
  removeArrowsFrom(pos: CellPosition): void;
  removeOutgoingArrows(pos: CellPosition): boolean;
  removeArrow(index: number): Promise<void>;
  drawArrows(): void;
  canStartExpand(pos: CellPosition): boolean;
  setArrowHoverTarget(pos: CellPosition): void;
  clearArrowHoverTargetIfMatches(pos: CellPosition): void;
}

export function createArrowAndExpansionController(
  context: ArrowAndExpansionContext,
  options: ArrowAndExpansionOptions
): ArrowAndExpansionController {
  let arrowDraft: ArrowDraft = { from: null };
  let arrowHoverTarget: CellPosition | null = null;
  let expandDraft: ExpandDraft = { from: null };

  function getArrowFrom(): CellPosition | null {
    return arrowDraft.from;
  }

  function getArrowHoverTarget(): CellPosition | null {
    return arrowHoverTarget;
  }

  function getExpandFrom(): CellPosition | null {
    return expandDraft.from;
  }

  function startArrow(pos: CellPosition): void {
    const state = context.getState();
    if (state.rows[pos.row].cells[pos.cycle].struck) return;
    expandDraft = { from: null };
    arrowDraft = { from: { ...pos } };
    arrowHoverTarget = null;
    options.refreshCellClasses();
    options.renderSelectionInfo();
  }

  function startExpand(pos: CellPosition): void {
    if (!canStartExpand(pos)) return;
    cancelArrowDraft();
    expandDraft = { from: { ...pos } };
    options.refreshCellClasses();
    options.renderSelectionInfo();
  }

  function removeArrowsFrom(pos: CellPosition): void {
    if (removeOutgoingArrows(pos)) {
      context.render();
      context.scheduleSave();
    }
  }

  function tryCreateArrowTo(to: CellPosition): void {
    const from = arrowDraft.from;
    if (!from) return;
    options.hideAutocomplete();
    const state = context.getState();
    if (state.rows[from.row].cells[from.cycle].struck) {
      cancelArrowDraft();
      options.refreshCellClasses();
      return;
    }
    if (!isValidArrowTarget(from, to, state)) {
      cancelArrowDraft();
      options.refreshCellClasses();
      showTemporaryInvalidTarget();
      return;
    }
    state.arrows.push({ from: { ...from }, to: { ...to }, label: "" });
    cancelArrowDraft();
    context.render();
    context.scheduleSave();
  }

  function cancelArrowDraft(): void {
    arrowDraft = { from: null };
    arrowHoverTarget = null;
  }

  async function tryExpandTo(to: CellPosition): Promise<void> {
    const from = expandDraft.from;
    if (!from) return;
    if (to.row !== from.row || to.cycle <= from.cycle) {
      showTemporaryInvalidTarget();
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
    context.render();
    context.scheduleSave();
  }

  function cancelExpandDraft(): void {
    expandDraft = { from: null };
  }

  function canStartExpand(pos: CellPosition): boolean {
    return canStartExpandStage(context.getState(), pos);
  }

  async function removeArrow(index: number): Promise<void> {
    if (!(await context.showConfirm("Delete arrow", "Delete this arrow?", "Delete"))) return;
    context.getState().arrows.splice(index, 1);
    context.render();
    context.scheduleSave();
  }

  function drawArrows(): void {
    drawArrowLayer(context.elements.cycleViewport, context.elements.arrowLayer, context.getState(), options.getCellElement, removeArrow);
  }

  function removeOutgoingArrows(pos: CellPosition): boolean {
    return removeOutgoingArrowsFromState(context.getState(), pos);
  }

  function setArrowHoverTarget(pos: CellPosition): void {
    if (!arrowDraft.from) return;
    arrowHoverTarget = { ...pos };
    options.refreshCellClasses();
  }

  function clearArrowHoverTargetIfMatches(pos: CellPosition): void {
    if (!arrowHoverTarget) return;
    if (samePos(arrowHoverTarget, pos)) {
      arrowHoverTarget = null;
      options.refreshCellClasses();
    }
  }

  function showTemporaryInvalidTarget(): void {
    context.showStatus("Invalid target");
    window.setTimeout(() => {
      context.showStatus("");
    }, 1400);
  }

  return {
    getArrowFrom,
    getArrowHoverTarget,
    getExpandFrom,
    startArrow,
    tryCreateArrowTo,
    cancelArrowDraft,
    startExpand,
    tryExpandTo,
    cancelExpandDraft,
    removeArrowsFrom,
    removeOutgoingArrows,
    removeArrow,
    drawArrows,
    canStartExpand,
    setArrowHoverTarget,
    clearArrowHoverTargetIfMatches
  };
}
