import { tokenizeAssembly } from "../core/assembly";
import type { AppState, CellPosition, StageRoot } from "../core/model";
import { getValidRoot, isCellTextValid } from "../core/validation";

export async function exportPng(state: AppState): Promise<Blob> {
  const metrics = makeImageMetrics(state);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = metrics.width * scale;
  canvas.height = metrics.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.scale(scale, scale);
  drawImageBackground(ctx, metrics);
  drawImageTable(ctx, state, metrics);
  drawImageArrows(ctx, state, metrics);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

interface ImageMetrics {
  width: number;
  height: number;
  margin: number;
  titleHeight: number;
  headerHeight: number;
  rowHeight: number;
  instructionWidth: number;
  cycleWidth: number;
  tableX: number;
  tableY: number;
}

interface StageStyle {
  background: string;
  border: string;
  color: string;
}

const stageStyles: Record<StageRoot, StageStyle> = {
  IF: { background: "#dff7c7", border: "#8bc36f", color: "#263241" },
  ID: { background: "#d9eefc", border: "#72aee6", color: "#263241" },
  EX: { background: "#ffe8a8", border: "#d6a534", color: "#263241" },
  MEM: { background: "#dfdcff", border: "#9488df", color: "#263241" },
  WB: { background: "#c9f3ec", border: "#48b7a6", color: "#263241" }
};

function makeImageMetrics(state: AppState): ImageMetrics {
  const margin = 24;
  const titleHeight = 52;
  const headerHeight = 38;
  const rowHeight = 46;
  const instructionWidth = 300;
  const cycleWidth = 78;
  return {
    margin,
    titleHeight,
    headerHeight,
    rowHeight,
    instructionWidth,
    cycleWidth,
    tableX: margin,
    tableY: margin + titleHeight,
    width: margin * 2 + instructionWidth + state.cycles * cycleWidth,
    height: margin * 2 + titleHeight + headerHeight + state.rows.length * rowHeight
  };
}

function drawImageBackground(ctx: CanvasRenderingContext2D, metrics: ImageMetrics): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, metrics.width, metrics.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "700 20px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "top";
}

function drawImageTable(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
  drawTitle(ctx, state, metrics);
  drawHeader(ctx, state, metrics);
  state.rows.forEach((row, rowIndex) => {
    const y = metrics.tableY + metrics.headerHeight + rowIndex * metrics.rowHeight;
    drawTableCell(ctx, metrics.tableX, y, metrics.instructionWidth, metrics.rowHeight, "#ffffff");
    drawInstructionText(ctx, row.instruction, metrics.tableX + 10, y + 14, metrics.instructionWidth - 20);

    row.cells.forEach((cell, cycleIndex) => {
      const x = metrics.tableX + metrics.instructionWidth + cycleIndex * metrics.cycleWidth;
      drawTableCell(ctx, x, y, metrics.cycleWidth, metrics.rowHeight, "#ffffff");
      drawStageCell(ctx, state, { row: rowIndex, cycle: cycleIndex }, x, y, metrics);
    });
  });
}

function drawTitle(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
  ctx.fillStyle = "#17202a";
  ctx.font = "700 20px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(state.title || "Exercise", metrics.margin, metrics.margin);
  ctx.fillStyle = "#64748b";
  ctx.font = "13px Segoe UI, Arial, sans-serif";
  ctx.fillText("Pipeline table", metrics.margin, metrics.margin + 28);
}

function drawHeader(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
  const y = metrics.tableY;
  drawTableCell(ctx, metrics.tableX, y, metrics.instructionWidth, metrics.headerHeight, "#edf3f8");
  drawHeaderText(ctx, "Instruction", metrics.tableX + metrics.instructionWidth / 2, y + metrics.headerHeight / 2);

  for (let cycle = 0; cycle < state.cycles; cycle += 1) {
    const x = metrics.tableX + metrics.instructionWidth + cycle * metrics.cycleWidth;
    drawTableCell(ctx, x, y, metrics.cycleWidth, metrics.headerHeight, "#edf3f8");
    drawHeaderText(ctx, String(cycle + 1), x + metrics.cycleWidth / 2, y + metrics.headerHeight / 2);
  }
}

function drawHeaderText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = "#415165";
  ctx.font = "800 12px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawTableCell(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#d7dee8";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);
}

function drawInstructionText(ctx: CanvasRenderingContext2D, instruction: string, x: number, y: number, maxWidth: number): void {
  const tokens = tokenizeAssembly(instruction);
  let cursor = x;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "14px Segoe UI, Arial, sans-serif";

  tokens.forEach((token) => {
    ctx.fillStyle = getAssemblyTokenColor(token.kind);
    ctx.font = token.kind === "plain" ? "14px Segoe UI, Arial, sans-serif" : "800 14px Segoe UI, Arial, sans-serif";
    const remainingWidth = x + maxWidth - cursor;
    if (remainingWidth > 0) ctx.fillText(token.text, cursor, y, remainingWidth);
    cursor += ctx.measureText(token.text).width;
  });
}

function getAssemblyTokenColor(kind: "instruction" | "register" | "plain"): string {
  if (kind === "instruction") return "#7c3aed";
  if (kind === "register") return "#b7791f";
  return "#111827";
}

function drawStageCell(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  pos: CellPosition,
  x: number,
  y: number,
  metrics: ImageMetrics
): void {
  const cell = state.rows[pos.row].cells[pos.cycle];
  const text = cell.text.trim();
  if (!text && !cell.struck) return;

  const root = getValidRoot(text);
  const isInvalid = Boolean(text) && !isCellTextValid(text, state, pos);
  const style = getStageStyle(root, isInvalid, text.endsWith("p"), cell.struck);
  const rectX = x + 5;
  const rectY = y + 6;
  const rectWidth = metrics.cycleWidth - 10;
  const rectHeight = metrics.rowHeight - 12;

  ctx.fillStyle = style.background;
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1;
  roundedRect(ctx, rectX, rectY, rectWidth, rectHeight, 8);
  ctx.fill();
  ctx.stroke();

  if (!text) return;
  ctx.fillStyle = style.color;
  ctx.font = "800 13px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + metrics.cycleWidth / 2, y + metrics.rowHeight / 2, rectWidth - 8);
  if (cell.struck) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rectX + 9, y + metrics.rowHeight / 2);
    ctx.lineTo(rectX + rectWidth - 9, y + metrics.rowHeight / 2);
    ctx.stroke();
  }
}

function getStageStyle(root: StageRoot | null, invalid: boolean, pending: boolean, struck: boolean): StageStyle {
  if (invalid) return { background: "#ffe4e8", border: "#e11d48", color: "#8f1235" };
  const base = root ? stageStyles[root] : { background: "#f1f5f9", border: "#d7dee8", color: "#263241" };
  if (pending || struck) {
    return {
      background: mixColor(base.background, "#cfd6df", pending ? 0.72 : 0.82),
      border: mixColor(base.border, "#7d8998", pending ? 0.74 : 0.82),
      color: struck ? "#485463" : "#3f4b5a"
    };
  }
  return base;
}

function drawImageArrows(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
  state.arrows.forEach((arrow) => {
    const from = getImageCellCenter(arrow.from, metrics);
    const to = getImageCellCenter(arrow.to, metrics);
    const controlOffset = Math.max(28, Math.abs(to.y - from.y) * 0.35);

    ctx.strokeStyle = "#2563eb";
    ctx.fillStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(from.x + 18, from.y + controlOffset, to.x - 18, to.y - controlOffset, to.x, to.y);
    ctx.stroke();
    drawArrowHead(ctx, to.x, to.y, Math.atan2(to.y - from.y, to.x - from.x));
  });
}

function getImageCellCenter(pos: CellPosition, metrics: ImageMetrics): { x: number; y: number } {
  return {
    x: metrics.tableX + metrics.instructionWidth + pos.cycle * metrics.cycleWidth + metrics.cycleWidth / 2,
    y: metrics.tableY + metrics.headerHeight + pos.row * metrics.rowHeight + metrics.rowHeight / 2
  };
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
  const size = 9;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function mixColor(first: string, second: string, secondWeight: number): string {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const firstWeight = 1 - secondWeight;
  return `rgb(${Math.round(a.r * firstWeight + b.r * secondWeight)}, ${Math.round(
    a.g * firstWeight + b.g * secondWeight
  )}, ${Math.round(a.b * firstWeight + b.b * secondWeight)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}
