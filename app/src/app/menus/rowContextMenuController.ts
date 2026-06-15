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
  const commands: Record<RowContextAction, (rowIndex: number) => void> = {
    "edit-label": actions.editRowLabel,
    "remove-label": actions.removeRowLabel,
    "toggle-separator": actions.toggleRowSeparator,
    copy: actions.copyInstruction,
    cut: actions.cutInstruction,
    paste: actions.pasteInstruction,
    clear: actions.clearInstruction
  };

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
    commands[action](contextRow);
    hideRowMenu();
  }

  return { openRowMenu, hideRowMenu, bindEvents };
}

