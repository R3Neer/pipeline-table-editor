import type { AppState } from "../core/model";
import type { AppElements } from "../ui/dom";

export interface AppControllerContext {
  elements: AppElements;
  getState(): AppState;
  setState(nextState: AppState): void;
  render(): void;
  saveState(manual: boolean): void;
  showStatus(message: string): void;
  showNotice(title: string, message: string): Promise<boolean>;
}

