import type { AppState, CellPosition } from "../core/model";
import type { AppElements } from "../ui/dom";
import { createArrowDraftController } from "./arrowDraftController";
import { createExpansionDraftController } from "./expansionDraftController";

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
  const showInvalidTarget = () => showTemporaryInvalidTarget(context.showStatus);
  const expansion = createExpansionDraftController(context, {
    getCellElement: options.getCellElement,
    refreshCellClasses: options.refreshCellClasses,
    renderSelectionInfo: options.renderSelectionInfo,
    cancelArrowDraft: () => arrows.cancelArrowDraft(),
    showInvalidTarget
  });
  const arrows = createArrowDraftController(context, {
    getCellElement: options.getCellElement,
    hideAutocomplete: options.hideAutocomplete,
    refreshCellClasses: options.refreshCellClasses,
    renderSelectionInfo: options.renderSelectionInfo,
    clearExpandDraft: expansion.cancelExpandDraft,
    showInvalidTarget
  });

  return {
    getArrowFrom: arrows.getArrowFrom,
    getArrowHoverTarget: arrows.getArrowHoverTarget,
    getExpandFrom: expansion.getExpandFrom,
    startArrow: arrows.startArrow,
    tryCreateArrowTo: arrows.tryCreateArrowTo,
    cancelArrowDraft: arrows.cancelArrowDraft,
    startExpand: expansion.startExpand,
    tryExpandTo: expansion.tryExpandTo,
    cancelExpandDraft: expansion.cancelExpandDraft,
    removeArrowsFrom: arrows.removeArrowsFrom,
    removeOutgoingArrows: arrows.removeOutgoingArrows,
    removeArrow: arrows.removeArrow,
    drawArrows: arrows.drawArrows,
    canStartExpand: expansion.canStartExpand,
    setArrowHoverTarget: arrows.setArrowHoverTarget,
    clearArrowHoverTargetIfMatches: arrows.clearArrowHoverTargetIfMatches
  };
}

function showTemporaryInvalidTarget(showStatus: (message: string) => void): void {
  showStatus("Invalid target");
  window.setTimeout(() => {
    showStatus("");
  }, 1400);
}
