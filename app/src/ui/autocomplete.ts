import { getAutocompleteSuggestions } from "../core/autocomplete";
import type { AppState, CellPosition } from "../core/model";
import { placeDropdown } from "./positioning";

export interface ActiveSuggestion {
  pos: CellPosition | null;
  values: string[];
  index: number;
}

export const emptySuggestion: ActiveSuggestion = { pos: null, values: [], index: 0 };

export function createAutocompleteController(menu: HTMLElement) {
  let active: ActiveSuggestion = { ...emptySuggestion };

  return {
    get active() {
      return active;
    },
    show(input: HTMLInputElement, pos: CellPosition, state: AppState): void {
      const values = getAutocompleteSuggestions(state, pos, input.value);
      active = { pos: { ...pos }, values, index: 0 };
      if (!values.length) {
        this.hide();
        return;
      }

      const rect = input.getBoundingClientRect();
      menu.replaceChildren(
        ...values.map((value, index) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = `autocomplete-option${index === 0 ? " active" : ""}`;
          option.textContent = value;
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            menu.dispatchEvent(new CustomEvent("autocomplete:accept", { detail: value }));
          });
          return option;
        })
      );
      menu.setAttribute("aria-hidden", "false");
      placeDropdown(menu, rect, 150);
    },
    hide(): void {
      active = { ...emptySuggestion };
      menu.setAttribute("aria-hidden", "true");
    },
    move(direction: number): void {
      const total = active.values.length;
      if (!total) return;
      active = {
        ...active,
        index: (active.index + direction + total) % total
      };
      menu.querySelectorAll(".autocomplete-option").forEach((option, index) => {
        option.classList.toggle("active", index === active.index);
      });
    }
  };
}
