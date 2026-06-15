import type { AppState } from "../../core/model";
import { createDefaultState } from "../../core/state";
import {
  applyInstructionText,
  changeCycleCount,
  wouldLoseCellsAfterCycleReduction
} from "../../core/useCases/tableEditing";
import type { AppElements } from "../../ui/dom";
import type { AppMutationEffects } from "../appEffects";

export interface TableWorkflowController {
  applyInstructions(): void;
  changeCycles(): Promise<void>;
  clearAll(): Promise<void>;
}

interface TableWorkflowControllerOptions {
  elements: AppElements;
  getState(): AppState;
  setState(nextState: AppState): void;
  render(): void;
  effects: Pick<AppMutationEffects, "renderAndSave">;
  saveState(immediate?: boolean): void;
  showConfirm(title: string, message: string, acceptLabel?: string): Promise<boolean>;
  resetTransientState(): void;
  clearSelections(): void;
}

export function createTableWorkflowController({
  elements,
  getState,
  setState,
  render,
  effects,
  saveState,
  showConfirm,
  resetTransientState,
  clearSelections
}: TableWorkflowControllerOptions): TableWorkflowController {
  function applyInstructions(): void {
    applyInstructionText(getState(), elements.instructionsInput.value);
    resetTransientState();
    clearSelections();
    effects.renderAndSave();
  }

  async function changeCycles(): Promise<void> {
    const state = getState();
    const nextCycles = Math.max(1, Number.parseInt(elements.cyclesInput.value, 10) || 1);
    if (nextCycles === state.cycles) return;
    if (nextCycles < state.cycles && wouldLoseCellsAfterCycleReduction(state, nextCycles)) {
      const ok = await showConfirm("Reduce cycles", "Reducing cycles will delete content. Continue?", "Reduce");
      if (!ok) {
        elements.cyclesInput.value = String(state.cycles);
        return;
      }
    }
    changeCycleCount(state, nextCycles);
    effects.renderAndSave();
  }

  async function clearAll(): Promise<void> {
    if (!(await showConfirm("Clear table", "Clear the whole table?", "Clear"))) return;
    setState(createDefaultState());
    resetTransientState();
    clearSelections();
    render();
    saveState(true);
  }

  return {
    applyInstructions,
    changeCycles,
    clearAll
  };
}


