import type { AppState } from "../core/model";
import { normalizeState } from "../core/state";
import { exportPng } from "../export/index";
import { createTextExportFile } from "../export/service";
import type { ExportFormat } from "../export/types";
import { downloadBlob, makeDownloadSlug } from "../ui/download";
import type { AppControllerContext } from "./appContext";

export interface ExportImportController {
  showExport(format: ExportFormat): Promise<void>;
  downloadTextExport(): void;
  hideExport(): void;
  toggleExportMenu(): void;
  hideExportMenu(): void;
  importJson(): Promise<void>;
  copyExport(): Promise<void>;
}

interface ExportImportControllerOptions {
  onStateImported(): void;
}

export function createExportImportController(
  context: AppControllerContext,
  options: ExportImportControllerOptions
): ExportImportController {
  let activeTextExportFormat: Exclude<ExportFormat, "png"> | null = null;
  const { elements } = context;

  async function showExport(format: ExportFormat): Promise<void> {
    if (format === "png") {
      await downloadPngExport();
      return;
    }
    const output = createTextExportFile(context.getState(), format).content;
    activeTextExportFormat = format;
    elements.exportOutput.value = output;
    elements.exportModal.setAttribute("aria-hidden", "false");
  }

  function downloadTextExport(): void {
    if (!activeTextExportFormat) return;
    const state = context.getState();
    const file = createTextExportFile(state, activeTextExportFormat);
    const blob = new Blob([elements.exportOutput.value], { type: file.mimeType });
    downloadBlob(blob, `${makeDownloadSlug(state.title || "pipeline-table")}.${file.extension}`);
    context.showStatus("File exported");
  }

  async function downloadPngExport(): Promise<void> {
    try {
      const state = context.getState();
      const blob = await exportPng(state);
      downloadBlob(blob, `${makeDownloadSlug(state.title || "pipeline-table")}.png`);
      context.showStatus("PNG exported");
    } catch (error) {
      await context.showNotice("PNG export failed", error instanceof Error ? error.message : String(error));
    }
  }

  function hideExport(): void {
    activeTextExportFormat = null;
    elements.exportModal.setAttribute("aria-hidden", "true");
  }

  function toggleExportMenu(): void {
    const isOpen = elements.exportMenu.getAttribute("aria-hidden") === "false";
    elements.exportMenu.setAttribute("aria-hidden", isOpen ? "true" : "false");
    elements.exportMenuBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
  }

  function hideExportMenu(): void {
    elements.exportMenu.setAttribute("aria-hidden", "true");
    elements.exportMenuBtn.setAttribute("aria-expanded", "false");
  }

  async function importJson(): Promise<void> {
    try {
      const raw = JSON.parse(elements.importInput.value) as Partial<AppState>;
      context.setState(normalizeState(raw));
      options.onStateImported();
      context.render();
      context.saveState(true);
    } catch (error) {
      await context.showNotice("Invalid JSON", error instanceof Error ? error.message : String(error));
    }
  }

  async function copyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(elements.exportOutput.value);
      context.showStatus("Copied");
    } catch {
      elements.exportOutput.focus();
      elements.exportOutput.select();
      context.showStatus("Select and copy");
    }
  }

  return {
    showExport,
    downloadTextExport,
    hideExport,
    toggleExportMenu,
    hideExportMenu,
    importJson,
    copyExport
  };
}

