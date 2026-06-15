import { tokenizeAssembly } from "../core/assembly";
import { getLabelColor } from "../core/labels";
import { getAssemblyTokenColor } from "./imageTheme";

export function drawInstructionText(
  ctx: CanvasRenderingContext2D,
  label: string | undefined,
  instruction: string,
  knownLabels: string[],
  x: number,
  y: number,
  maxWidth: number
): void {
  const tokens = tokenizeAssembly(instruction);
  let cursor = x;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "14px Segoe UI, Arial, sans-serif";

  if (label) {
    ctx.fillStyle = getLabelColor(label);
    ctx.font = "italic 500 13px Segoe UI, Arial, sans-serif";
    const labelText = `${label}: `;
    ctx.fillText(labelText, cursor, y, maxWidth);
    cursor += ctx.measureText(labelText).width;
  }

  tokens.forEach((token) => {
    if (isKnownLabel(token.text, knownLabels)) {
      ctx.fillStyle = getLabelColor(token.text.replace(/:$/, ""));
      ctx.font = "italic 500 14px Segoe UI, Arial, sans-serif";
      cursor = drawImageText(ctx, token.text, cursor, y, x + maxWidth);
      return;
    }
    if (token.kind === "plain") {
      cursor = drawPlainInstructionText(ctx, token.text, knownLabels, cursor, y, x + maxWidth);
      return;
    }
    ctx.fillStyle = getAssemblyTokenColor(token.kind);
    ctx.font = token.kind === "annotation" ? "italic 800 14px Segoe UI, Arial, sans-serif" : "14px Segoe UI, Arial, sans-serif";
    cursor = drawImageText(ctx, token.text, cursor, y, x + maxWidth);
  });
}

function drawPlainInstructionText(
  ctx: CanvasRenderingContext2D,
  text: string,
  labels: string[],
  cursor: number,
  y: number,
  maxX: number
): number {
  const pattern = labels.length ? makeLabelPattern(labels) : null;
  if (!pattern) {
    ctx.fillStyle = getAssemblyTokenColor("plain");
    ctx.font = "14px Segoe UI, Arial, sans-serif";
    return drawImageText(ctx, text, cursor, y, maxX);
  }

  let start = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > start) {
      ctx.fillStyle = getAssemblyTokenColor("plain");
      ctx.font = "14px Segoe UI, Arial, sans-serif";
      cursor = drawImageText(ctx, text.slice(start, match.index), cursor, y, maxX);
    }
    ctx.fillStyle = getLabelColor(match[0].replace(/:$/, ""));
    ctx.font = "italic 500 14px Segoe UI, Arial, sans-serif";
    cursor = drawImageText(ctx, match[0], cursor, y, maxX);
    start = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (start < text.length) {
    ctx.fillStyle = getAssemblyTokenColor("plain");
    ctx.font = "14px Segoe UI, Arial, sans-serif";
    cursor = drawImageText(ctx, text.slice(start), cursor, y, maxX);
  }
  return cursor;
}

function drawImageText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxX: number): number {
  const remainingWidth = maxX - x;
  if (remainingWidth > 0) ctx.fillText(text, x, y, remainingWidth);
  return x + ctx.measureText(text).width;
}

function isKnownLabel(text: string, labels: string[]): boolean {
  return labels.some((label) => label.toLowerCase() === text.replace(/:$/, "").toLowerCase());
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeLabelPattern(labels: string[]): RegExp {
  return new RegExp(`\\b(${labels.map(escapeRegExp).join("|")}):?(?=\\W|$)`, "gi");
}
