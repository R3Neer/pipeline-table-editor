import { samePos } from "../core/arrows";
import type { AppState, CellPosition } from "../core/model";
import type { AppElements } from "../ui/dom";
import type { ContextAction } from "../ui/menuActions";
import { placeFloatingElement } from "../ui/positioning";
import type { ContextMenuActions } from "./contextMenuTypes";

interface CellContextMenuControllerOptions {
  elements: AppElements;
  getState(): AppState;
  isMultiSelection(): boolean;
  canStartExpand(pos: CellPosition): boolean;
  actions: ContextMenuActions;
}

export interface CellContextMenuController {
  openCellMenu(pos: CellPosition, x: number, y: number): void;
  hideCellMenu(): void;
  bindEvents(): void;
}

export function createCellContextMenuController({
  elements,
  getState,
  isMultiSelection,
  canStartExpand,
  actions
}: CellContextMenuControllerOptions): CellContextMenuController {
  let contextCell: CellPosition | null = null;

  function openCellMenu(pos: CellPosition, x: number, y: number): void {
    contextCell = pos;
    const state = getState();
    const currentCell = state.rows[pos.row].cells[pos.cycle];
    const hasMultipleCells = isMultiSelection();
    const arrowButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="arrow"]');
    if (arrowButton) {
      arrowButton.hidden = hasMultipleCells || Boolean(currentCell?.struck);
    }
    const expandButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="expand"]');
    if (expandButton) {
      expandButton.hidden = hasMultipleCells || !canStartExpand(pos);
    }
    const removeButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="remove-arrows"]');
    if (removeButton) {
      const hasOutgoing = state.arrows.some((arrow) => samePos(arrow.from, pos));
      removeButton.hidden = Boolean(currentCell?.struck) || !hasOutgoing;
    }
    const strikeButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="strike"]');
    if (strikeButton) {
      strikeButton.textContent = currentCell.struck ? "Remove strike" : "Strike";
    }
    const copyButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="copy"]');
    if (copyButton) copyButton.hidden = hasMultipleCells;
    const cutButton = elements.cellMenu.querySelector<HTMLButtonElement>('[data-action="cut"]');
    if (cutButton) cutButton.hidden = hasMultipleCells;
    elements.cellMenu.setAttribute("aria-hidden", "false");
    placeFloatingElement(elements.cellMenu, x, y);
  }

  function hideCellMenu(): void {
    elements.cellMenu.setAttribute("aria-hidden", "true");
  }

  function bindEvents(): void {
    elements.cellMenu.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
      if (button) handleCellAction(button.dataset.action as ContextAction);
    });
  }

  function handleCellAction(action: ContextAction): void {
    if (!contextCell) return;
    if (action === "arrow") actions.startArrow(contextCell);
    if (action === "remove-arrows") actions.removeArrowsFrom(contextCell);
    if (action === "strike") actions.toggleStrike(contextCell);
    if (action === "expand") actions.startExpand(contextCell);
    if (action === "copy") actions.copyCell(contextCell);
    if (action === "cut") actions.cutCell(contextCell);
    if (action === "paste") actions.pasteCell(contextCell);
    if (action === "clear") actions.clearCell(contextCell);
    hideCellMenu();
  }

  return { openCellMenu, hideCellMenu, bindEvents };
}
