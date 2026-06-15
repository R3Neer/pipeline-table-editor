import type { AppState } from "../core/model";
import { drawImageArrows } from "./imageArrows";
import { makeImageMetrics } from "./imageMetrics";
import { drawImageBackground, drawImageTable } from "./imageTable";

const exportScale = 2;

export async function exportPng(state: AppState): Promise<Blob> {
  const metrics = makeImageMetrics(state);
  const canvas = document.createElement("canvas");
  canvas.width = metrics.width * exportScale;
  canvas.height = metrics.height * exportScale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.scale(exportScale, exportScale);
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
