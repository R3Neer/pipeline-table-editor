import { normalizeRowLabel } from "../../core/labels";
import type { AppState } from "../../core/model";
import type { AppElements } from "../../ui/dom";
import type { AppMutationEffects } from "../appEffects";

export interface LabelModalController {
  open(rowIndex: number): void;
  hide(): void;
  bindEvents(): void;
}

interface LabelModalControllerOptions {
  elements: AppElements;
  getState(): AppState;
  effects: Pick<AppMutationEffects, "renderAndSave">;
}

export function createLabelModalController({
  elements,
  getState,
  effects
}: LabelModalControllerOptions): LabelModalController {
  let labelEditRow: number | null = null;

  function open(rowIndex: number): void {
    labelEditRow = rowIndex;
    const current = getState().rows[rowIndex].label || "";
    elements.labelModalTitle.textContent = current ? "Edit label" : "Add label";
    elements.labelInput.value = current;
    elements.labelModal.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      elements.labelInput.focus();
      elements.labelInput.select();
    });
  }

  function save(): void {
    if (labelEditRow === null) return;
    const state = getState();
    const label = normalizeRowLabel(elements.labelInput.value);
    if (label) {
      state.rows[labelEditRow].label = label;
    } else {
      delete state.rows[labelEditRow].label;
    }
    hide();
    effects.renderAndSave();
  }

  function hide(): void {
    labelEditRow = null;
    elements.labelModal.setAttribute("aria-hidden", "true");
  }

  function bindEvents(): void {
    elements.saveLabelBtn.addEventListener("click", save);
    elements.cancelLabelBtn.addEventListener("click", hide);
    elements.labelInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        hide();
      }
    });
    elements.labelModal.addEventListener("click", (event) => {
      if (event.target === elements.labelModal) hide();
    });
  }

  return {
    open,
    hide,
    bindEvents
  };
}


