import { isValidArrowTarget, samePos } from "../../core/arrows";
import type { AppState, CellPosition } from "../../core/model";
import { removeOutgoingArrows as removeOutgoingArrowsFromState } from "../../core/useCases/tableEditing";
import { drawArrows as drawArrowLayer } from "../../ui/arrows";
import type { AppElements } from "../../ui/dom";
import type { ArrowDraft } from "../sessionTypes";

interface ArrowDraftContext {
  elements: AppElements;
  getState(): AppState;
  render(): void;
  scheduleSave(): void;
  showConfirm(title: string, message: string, acceptText?: string): Promise<boolean>;
}

interface ArrowDraftOptions {
  getCellElement(pos: CellPosition): HTMLInputElement | null;
  hideAutocomplete(): void;
  refreshCellClasses(): void;
  renderSelectionInfo(): void;
  clearExpandDraft(): void;
  showInvalidTarget(): void;
}

export interface ArrowDraftController {
  getArrowFrom(): CellPosition | null;
  getArrowHoverTarget(): CellPosition | null;
  startArrow(pos: CellPosition): void;
  tryCreateArrowTo(to: CellPosition): void;
  cancelArrowDraft(): void;
  removeArrowsFrom(pos: CellPosition): void;
  removeOutgoingArrows(pos: CellPosition): boolean;
  removeArrow(index: number): Promise<void>;
  drawArrows(): void;
  setArrowHoverTarget(pos: CellPosition): void;
  clearArrowHoverTargetIfMatches(pos: CellPosition): void;
}

export function createArrowDraftController(
  context: ArrowDraftContext,
  options: ArrowDraftOptions
): ArrowDraftController {
  let arrowDraft: ArrowDraft = { from: null };
  let arrowHoverTarget: CellPosition | null = null;

  function getArrowFrom(): CellPosition | null {
    return arrowDraft.from;
  }

  function getArrowHoverTarget(): CellPosition | null {
    return arrowHoverTarget;
  }

  function startArrow(pos: CellPosition): void {
    const state = context.getState();
    if (state.rows[pos.row].cells[pos.cycle].struck) return;
    options.clearExpandDraft();
    arrowDraft = { from: { ...pos } };
    arrowHoverTarget = null;
    options.refreshCellClasses();
    options.renderSelectionInfo();
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
      options.showInvalidTarget();
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

  function removeArrowsFrom(pos: CellPosition): void {
    if (removeOutgoingArrows(pos)) {
      context.render();
      context.scheduleSave();
    }
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

  return {
    getArrowFrom,
    getArrowHoverTarget,
    startArrow,
    tryCreateArrowTo,
    cancelArrowDraft,
    removeArrowsFrom,
    removeOutgoingArrows,
    removeArrow,
    drawArrows,
    setArrowHoverTarget,
    clearArrowHoverTargetIfMatches
  };
}

