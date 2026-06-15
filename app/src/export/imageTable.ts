import { getKnownLabels } from "../core/labels";
import type { AppState, CellPosition } from "../core/model";
import { getValidRoot, isCellTextValid } from "../core/validation";
import type { ImageMetrics } from "./imageMetrics";
import { drawSeparator, drawTableCell, roundedRect } from "./imagePrimitives";
import { drawInstructionText } from "./imageText";
import { getStageStyle } from "./imageTheme";

export function drawImageBackground(ctx: CanvasRenderingContext2D, metrics: ImageMetrics): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, metrics.width, metrics.height);
  ctx.fillStyle = "#17202a";
  ctx.font = "700 20px Segoe UI, Arial, sans-serif";
  ctx.textBaseline = "top";
}

export function drawImageTable(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
  drawTitle(ctx, state, metrics);
  drawHeader(ctx, state, metrics);
  const knownLabels = getKnownLabels(state.rows.map((row) => row.label));
  state.rows.forEach((row, rowIndex) => {
    const y = metrics.tableY + metrics.headerHeight + rowIndex * metrics.rowHeight;
    drawTableCell(ctx, metrics.tableX, y, metrics.instructionWidth, metrics.rowHeight, "#ffffff");
    drawInstructionText(ctx, row.label, row.instruction, knownLabels, metrics.tableX + 10, y + 14, metrics.instructionWidth - 20);

    row.cells.forEach((cell, cycleIndex) => {
      const x = metrics.tableX + metrics.instructionWidth + cycleIndex * metrics.cycleWidth;
      drawTableCell(ctx, x, y, metrics.cycleWidth, metrics.rowHeight, "#ffffff");
      drawStageCell(ctx, state, { row: rowIndex, cycle: cycleIndex }, x, y, metrics);
    });
    if (row.separatorBefore) drawSeparator(ctx, metrics.tableX, y, metrics.instructionWidth + state.cycles * metrics.cycleWidth);
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
