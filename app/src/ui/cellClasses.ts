import { isValidArrowTarget } from "../core/arrows";
import type { AppState, CellPosition } from "../core/model";
import { positionKey } from "../core/selection";
import { getValidRoot, isCellTextValid } from "../core/validation";

export interface CellVisualState {
  selectedCell: CellPosition | null;
  selectedCellKeys: Set<string>;
  arrowFrom: CellPosition | null;
  arrowHoverTarget: CellPosition | null;
  expandFrom: CellPosition | null;
}

export function getCellClassName(state: AppState, pos: CellPosition, visual: CellVisualState): string {
  const cell = state.rows[pos.row].cells[pos.cycle];
  const classes = ["stage-input"];
  const value = cell.text.trim();
  const root = getValidRoot(value);

  if (value && !isCellTextValid(value, state, pos)) {
    classes.push("stage-invalid");
  } else if (root) {
    classes.push(`stage-${root.toLowerCase()}`);
    if (value.endsWith("p")) classes.push("stage-p");
  }

  if (cell.struck) classes.push("stage-struck");
  if (visual.selectedCell && samePosition(visual.selectedCell, pos)) classes.push("selected");
  if (visual.selectedCellKeys.size > 1 && visual.selectedCellKeys.has(positionKey(pos))) classes.push("multi-selected");
  if (visual.arrowFrom && samePosition(visual.arrowFrom, pos)) classes.push("arrow-from");
  if (
    visual.arrowFrom &&
    visual.arrowHoverTarget &&
    samePosition(visual.arrowHoverTarget, pos) &&
    isValidArrowTarget(visual.arrowFrom, visual.arrowHoverTarget, state)
  ) {
    classes.push("arrow-target-valid");
  }
  if (visual.expandFrom && samePosition(visual.expandFrom, pos)) classes.push("expand-from");

  return classes.join(" ");
}

function samePosition(left: CellPosition, right: CellPosition): boolean {
  return left.row === right.row && left.cycle === right.cycle;
}
