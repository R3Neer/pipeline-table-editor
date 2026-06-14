import { samePos } from "../core/arrows";
import type { AppState, CellPosition } from "../core/model";
import type { AppElements } from "../ui/dom";
import type { ContextAction, RowContextAction } from "../ui/menuActions";
import { placeFloatingElement, placeSubmenu } from "../ui/positioning";
import type { SelectionController } from "./selectionController";

interface ContextMenuActions {
  startArrow(pos: CellPosition): void;
  removeArrowsFrom(pos: CellPosition): void;
  toggleStrike(pos: CellPosition): void;
  startExpand(pos: CellPosition): void;
  copyCell(pos: CellPosition): void;
  cutCell(pos: CellPosition): void;
  pasteCell(pos: CellPosition): void;
  clearCell(pos: CellPosition): void;
  editRowLabel(rowIndex: number): void;
  removeRowLabel(rowIndex: number): void;
  toggleRowSeparator(rowIndex: number): void;
  copyInstruction(rowIndex: number): void;
  cutInstruction(rowIndex: number): void;
  pasteInstruction(rowIndex: number): void;
  clearInstruction(rowIndex: number): void;
}

export interface ContextMenuController {
  openCellMenu(pos: CellPosition, x: number, y: number): void;
  openRowMenu(rowIndex: number, x: number, y: number): void;
  hideCellMenu(): void;
  hideRowMenu(): void;
  hideAll(): void;
  bindEvents(): void;
}

interface ContextMenuControllerOptions {
  elements: AppElements;
  selection: SelectionController;
  getState(): AppState;
  isMultiSelection(): boolean;
  canStartExpand(pos: CellPosition): boolean;
  actions: ContextMenuActions;
}

export function createContextMenuController({
  elements,
  selection,
  getState,
  isMultiSelection,
  canStartExpand,
  actions
}: ContextMenuControllerOptions): ContextMenuController {
  let contextCell: CellPosition | null = null;
  let contextRow: number | null = null;

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

  function openRowMenu(rowIndex: number, x: number, y: number): void {
    contextRow = rowIndex;
    const row = getState().rows[rowIndex];
    const hasMultipleRows = selection.getSelectedRows().size > 1 && selection.hasSelectedRow(rowIndex);
    const editLabelButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="edit-label"]');
    if (editLabelButton) {
      editLabelButton.textContent = row?.label ? "Edit label" : "Add label";
      editLabelButton.hidden = hasMultipleRows;
    }
    const removeLabelButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="remove-label"]');
    if (removeLabelButton) removeLabelButton.hidden = hasMultipleRows || !row?.label;
    const separatorButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="toggle-separator"]');
    if (separatorButton && row) {
      separatorButton.textContent = row.separatorBefore ? "Remove separator above" : "Add separator above";
      separatorButton.hidden = hasMultipleRows;
    }
    const copyButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="copy"]');
    if (copyButton) copyButton.hidden = hasMultipleRows;
    const cutButton = elements.rowMenu.querySelector<HTMLButtonElement>('[data-row-action="cut"]');
    if (cutButton) cutButton.hidden = hasMultipleRows;
    elements.rowMenu.setAttribute("aria-hidden", "false");
    placeFloatingElement(elements.rowMenu, x, y);
  }

  function hideCellMenu(): void {
    elements.cellMenu.setAttribute("aria-hidden", "true");
  }

  function hideRowMenu(): void {
    elements.rowMenu.setAttribute("aria-hidden", "true");
  }

  function hideAll(): void {
    hideCellMenu();
    hideRowMenu();
  }

  function bindEvents(): void {
    elements.cellMenu.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
      if (button) handleCellAction(button.dataset.action as ContextAction);
    });
    bindSubmenus(elements.cellMenu);
    bindSubmenus(elements.rowMenu);
    elements.rowMenu.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-row-action]") : null;
      if (button) handleRowAction(button.dataset.rowAction as RowContextAction);
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

  function handleRowAction(action: RowContextAction): void {
    if (contextRow === null) return;
    if (action === "edit-label") actions.editRowLabel(contextRow);
    if (action === "remove-label") actions.removeRowLabel(contextRow);
    if (action === "toggle-separator") actions.toggleRowSeparator(contextRow);
    if (action === "copy") actions.copyInstruction(contextRow);
    if (action === "cut") actions.cutInstruction(contextRow);
    if (action === "paste") actions.pasteInstruction(contextRow);
    if (action === "clear") actions.clearInstruction(contextRow);
    hideRowMenu();
  }

  return {
    openCellMenu,
    openRowMenu,
    hideCellMenu,
    hideRowMenu,
    hideAll,
    bindEvents
  };
}

function bindSubmenus(menu: HTMLElement): void {
  menu.querySelectorAll<HTMLElement>(".context-submenu").forEach((submenu) => {
    submenu.addEventListener("mouseenter", () => positionContextSubmenu(submenu));
    submenu.addEventListener("focusin", () => positionContextSubmenu(submenu));
  });
}

function positionContextSubmenu(submenu: HTMLElement): void {
  const panel = submenu.querySelector<HTMLElement>(".context-submenu-menu");
  if (!panel) return;
  const side = placeSubmenu(submenu, panel);
  submenu.classList.toggle("submenu-opens-left", side === "left");
}

