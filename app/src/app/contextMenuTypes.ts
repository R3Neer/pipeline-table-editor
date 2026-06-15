import type { CellPosition } from "../core/model";

export interface ContextMenuActions {
  startArrow(pos: CellPosition): void;
  removeArrowsFrom(pos: CellPosition): void;
  toggleStrike(pos: CellPosition): void;
  startExpand(pos: CellPosition): void;
  copyCell(pos: CellPosition): void;
  cutCell(pos: CellPosition): void;
  pasteCell(pos: CellPosition): void;
  clearCell(pos: CellPosition): void;
  editRowLabel(rowIndex: number): void;
  removeRowLabel(rowIndex: number): void;
  toggleRowSeparator(rowIndex: number): void;
  copyInstruction(rowIndex: number): void;
  cutInstruction(rowIndex: number): void;
  pasteInstruction(rowIndex: number): void;
  clearInstruction(rowIndex: number): void;
}
