import type { AppState, CellPosition } from "../core/model";
import type { ImageMetrics } from "./imageMetrics";

export function drawImageArrows(ctx: CanvasRenderingContext2D, state: AppState, metrics: ImageMetrics): void {
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
