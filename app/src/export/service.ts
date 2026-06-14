import type { AppState } from "../core/model";
import { exportJson, exportMarkdown, exportText } from "./index";
import type { ExportFormat } from "./types";

export interface TextExportFile {
  content: string;
  extension: string;
  mimeType: string;
}

export function createTextExportFile(state: AppState, format: Exclude<ExportFormat, "png">): TextExportFile {
  return {
    content: getTextExportContent(state, format),
    extension: getTextExportExtension(format),
    mimeType: getTextExportMimeType(format)
  };
}

export function getTextExportContent(state: AppState, format: Exclude<ExportFormat, "png">): string {
  if (format === "json") return exportJson(state);
  if (format === "markdown") return exportMarkdown(state);
  return exportText(state);
}

function getTextExportExtension(format: Exclude<ExportFormat, "png">): string {
  if (format === "json") return "json";
  if (format === "markdown") return "md";
  return "txt";
}

function getTextExportMimeType(format: Exclude<ExportFormat, "png">): string {
  if (format === "json") return "application/json;charset=utf-8";
  if (format === "markdown") return "text/markdown;charset=utf-8";
  return "text/plain;charset=utf-8";
}
