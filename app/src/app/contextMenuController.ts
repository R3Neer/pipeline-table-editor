import type { AppState, CellPosition } from "../core/model";
import type { AppElements } from "../ui/dom";
import { placeSubmenu } from "../ui/positioning";
import { createCellContextMenuController } from "./cellContextMenuController";
import type { ContextMenuActions } from "./contextMenuTypes";
import { createRowContextMenuController } from "./rowContextMenuController";
import type { SelectionController } from "./selectionController";

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
  const cellMenu = createCellContextMenuController({
    elements,
    getState,
    isMultiSelection,
    canStartExpand,
    actions
  });
  const rowMenu = createRowContextMenuController({
    elements,
    selection,
    getState,
    actions
  });

  function hideAll(): void {
    cellMenu.hideCellMenu();
    rowMenu.hideRowMenu();
  }

  function bindEvents(): void {
    cellMenu.bindEvents();
    rowMenu.bindEvents();
    bindSubmenus(elements.cellMenu);
    bindSubmenus(elements.rowMenu);
  }

  return {
    openCellMenu: cellMenu.openCellMenu,
    openRowMenu: rowMenu.openRowMenu,
    hideCellMenu: cellMenu.hideCellMenu,
    hideRowMenu: rowMenu.hideRowMenu,
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
