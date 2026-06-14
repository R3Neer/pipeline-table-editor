import type { AppState } from "../core/model";
import { normalizeState } from "../core/state";

const STORAGE_KEY = "pipeline-table-editor-state-v2";
const LEGACY_STORAGE_KEY = "pipeline-table-editor-state-v1";

export function loadStateFromStorage(storage: Storage = localStorage): AppState | null {
  try {
    const stored = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored) as Partial<AppState>) : null;
  } catch (error) {
    console.warn("Could not load localStorage", error);
    return null;
  }
}

export function saveStateToStorage(state: AppState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
