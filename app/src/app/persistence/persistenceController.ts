import type { AppState } from "../../core/model";
import { saveStateToStorage } from "../../integration/storage";
import type { AppElements } from "../../ui/dom";

export interface PersistenceController {
  scheduleSave(): void;
  saveState(manual: boolean): void;
}

interface PersistenceControllerOptions {
  elements: AppElements;
  getState(): AppState;
  showStatus(message: string): void;
}

export function createPersistenceController(options: PersistenceControllerOptions): PersistenceController {
  let saveTimer = 0;

  function scheduleSave(): void {
    options.showStatus("");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveState(false), 250);
  }

  function saveState(manual: boolean): void {
    saveStateToStorage(options.getState());
    options.showStatus(manual ? "Guardado" : "");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      options.showStatus("");
    }, 1400);
  }

  return { scheduleSave, saveState };
}


