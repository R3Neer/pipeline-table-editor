import type { ExportFormat } from "../../export/types";
import type { SplitTableController } from "../../ui/splitTable";
import type { AppElements } from "../../ui/dom";
import type { CellEditingController } from "../cells/cellEditingController";
import type { ContextMenuController } from "../menus/contextMenuController";
import type { ExportImportController } from "../workflows/exportImportController";
import type { LabelModalController } from "../modals/labelModalController";
import type { TableWorkflowController } from "../workflows/tableWorkflowController";

interface AppEventBindingsOptions {
  elements: AppElements;
  splitTable: SplitTableController;
  tableWorkflow: TableWorkflowController;
  exportImport: ExportImportController;
  labelModal: LabelModalController;
  contextMenu: ContextMenuController;
  cellEditing: CellEditingController;
  setTitle(title: string): void;
  scheduleSave(): void;
  drawArrows(): void;
  closeConfirmModal(accepted: boolean): void;
  hideAutocomplete(): void;
  cancelTransientUi(): void;
}

export function bindAppEvents({
  elements,
  splitTable,
  tableWorkflow,
  exportImport,
  labelModal,
  contextMenu,
  cellEditing,
  setTitle,
  scheduleSave,
  drawArrows,
  closeConfirmModal,
  hideAutocomplete,
  cancelTransientUi
}: AppEventBindingsOptions): void {
  elements.titleInput.addEventListener("input", () => {
    setTitle(elements.titleInput.value);
    scheduleSave();
  });
  elements.cyclesInput.addEventListener("change", () => {
    void tableWorkflow.changeCycles();
  });
  elements.instructionsInput.addEventListener("input", tableWorkflow.applyInstructions);
  elements.exportMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    exportImport.toggleExportMenu();
  });
  elements.exportMenu.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-export-format]") : null;
    if (!button) return;
    exportImport.hideExportMenu();
    void exportImport.showExport(button.dataset.exportFormat as ExportFormat);
  });
  elements.copyExportBtn.addEventListener("click", exportImport.copyExport);
  elements.downloadExportBtn.addEventListener("click", exportImport.downloadTextExport);
  elements.importBtn.addEventListener("click", () => {
    void exportImport.importJson();
  });
  elements.clearBtn.addEventListener("click", () => {
    void tableWorkflow.clearAll();
  });
  elements.collapseSidebarBtn.addEventListener("click", () => {
    elements.layoutRoot.classList.add("sidebar-collapsed");
    window.requestAnimationFrame(drawArrows);
  });
  elements.expandSidebarBtn.addEventListener("click", () => {
    elements.layoutRoot.classList.remove("sidebar-collapsed");
    window.requestAnimationFrame(drawArrows);
  });
  elements.closeExportBtn.addEventListener("click", exportImport.hideExport);
  elements.exportModal.addEventListener("click", (event) => {
    if (event.target === elements.exportModal) exportImport.hideExport();
  });
  labelModal.bindEvents();
  elements.acceptConfirmBtn.addEventListener("click", () => closeConfirmModal(true));
  elements.cancelConfirmBtn.addEventListener("click", () => closeConfirmModal(false));
  elements.confirmModal.addEventListener("click", (event) => {
    if (event.target === elements.confirmModal) closeConfirmModal(false);
  });
  contextMenu.bindEvents();
  elements.autocompleteMenu.addEventListener("autocomplete:accept", (event) => {
    cellEditing.acceptSuggestion((event as CustomEvent<string>).detail);
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Node && !elements.cellMenu.contains(event.target)) contextMenu.hideCellMenu();
    if (event.target instanceof Node && !elements.rowMenu.contains(event.target)) contextMenu.hideRowMenu();
    if (event.target instanceof Node && !elements.exportMenu.contains(event.target) && event.target !== elements.exportMenuBtn) {
      exportImport.hideExportMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Alt" || event.key === "Control" || event.key === "Meta" || event.key === "Shift") {
      hideAutocomplete();
    }
    if (event.key === "Escape") cancelTransientUi();
  });
  window.addEventListener("resize", () => {
    splitTable.syncLayout();
    drawArrows();
  });
  attachTextareaResizeHandles();
}

function attachTextareaResizeHandles(): void {
  document.querySelectorAll<HTMLElement>(".textarea-resize-handle").forEach((handle) => {
    const textarea = handle.previousElementSibling;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    let drag: { startY: number; startHeight: number } | null = null;
    handle.addEventListener("pointerdown", (event) => {
      drag = { startY: event.clientY, startHeight: textarea.getBoundingClientRect().height };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      textarea.style.height = `${Math.max(80, drag.startHeight + event.clientY - drag.startY)}px`;
    });
    handle.addEventListener("pointerup", () => {
      drag = null;
    });
    handle.addEventListener("pointercancel", () => {
      drag = null;
    });
  });
}


