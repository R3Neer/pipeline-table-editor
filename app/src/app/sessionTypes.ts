import type { CellData, CellPosition } from "../core/model";

export type CopiedCell = CellData;

export interface ArrowDraft {
  from: CellPosition | null;
}

export interface ExpandDraft {
  from: CellPosition | null;
}

