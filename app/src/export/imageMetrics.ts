import type { AppState } from "../core/model";

export interface ImageMetrics {
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

export function makeImageMetrics(state: AppState): ImageMetrics {
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
