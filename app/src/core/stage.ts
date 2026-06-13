import type { StageRoot } from "./model";
import { stageRoots } from "./model";

export const validCellPattern = /^(IF|ID|EX|MEM|WB)(p|[1-9]\d*p?)?$/;
const pendingPattern = /^(IF|ID|EX|MEM|WB)([1-9]\d*)?p$/;

export interface ParsedStage {
  root: StageRoot;
  number: number | null;
  pending: boolean;
}

export function normalizeCellText(raw: string): string {
  const text = raw.trim();
  const match = text.match(/^(if|id|ex|mem|wb)(p|P|[1-9]\d*[pP]?)?$/i);
  if (!match) return raw;

  const root = match[1].toUpperCase();
  const suffix = match[2] || "";
  return root + normalizeSuffix(suffix);
}

export function parseStageText(value: string): ParsedStage | null {
  const match = value.trim().match(validCellPattern);
  if (!match) return null;

  const suffix = match[2] || "";
  return {
    root: match[1] as StageRoot,
    number: suffix && suffix !== "p" ? Number(suffix.replace(/p$/, "")) : null,
    pending: suffix.endsWith("p")
  };
}

export function getValidRoot(value: string): StageRoot | null {
  return parseStageText(value)?.root || null;
}

export function isPendingStageText(value: string): boolean {
  return pendingPattern.test(value.trim());
}

export function formatStageText(root: StageRoot, number: number | null): string {
  return `${root}${number || ""}`;
}

export function formatPendingStageText(root: StageRoot, number: number | null): string {
  return `${formatStageText(root, number)}p`;
}

export function getStageOrder(root: StageRoot): number {
  return stageRoots.indexOf(root);
}

function normalizeSuffix(suffix: string): string {
  if (suffix.toLowerCase() === "p") return "p";
  return suffix.replace(/p$/i, "p");
}
