import type { AppState } from "../../core/model";
import type { AppElements } from "../../ui/dom";
import type { RowContextAction } from "../../ui/menuActions";
import { placeFloatingElement } from "../../ui/positioning";
import type { ContextMenuActions } from "./contextMenuTypes";
import type { SelectionController } from "../selection/selectionController";

interface RowContextMenuControllerOptions {
  elements: AppElements;
  selection: SelectionController;
  getState(): AppState;
  actions: ContextMenuActions;
}

export interface RowContextMenuController {
  openRowMenu(rowIndex: number, x: number, y: number): void;
  hideRowMenu(): void;
  bindEvents(): void;
}

export function createRowContextMenuController({
  elements,
  selection,
  getState,
  actions
}: RowContextMenuControllerOptions): RowContextMenuController {
  let contextRow: number | null = null;

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

  function hideRowMenu(): void {
    elements.rowMenu.setAttribute("aria-hidden", "true");
  }

  function bindEvents(): void {
    elements.rowMenu.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-row-action]") : null;
      if (button) handleRowAction(button.dataset.rowAction as RowContextAction);
    });
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

  return { openRowMenu, hideRowMenu, bindEvents };
}

