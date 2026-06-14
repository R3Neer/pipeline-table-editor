import type { AppElements } from "./dom";

const minInstructionColumnWidth = 320;
const maxInstructionColumnWidth = 520;

export function updateInstructionColumnWidth(elements: AppElements): void {
  const longestText = Math.max(
    0,
    ...[...elements.instructionMount.querySelectorAll<HTMLElement>(".instruction-main")].map((item) => item.scrollWidth)
  );
  const buttonAreaWidth = 3 * 34 + 2 * 7 + 12 + 20;
  const nextWidth = Math.min(maxInstructionColumnWidth, Math.max(minInstructionColumnWidth, longestText + buttonAreaWidth));
  elements.tableShell.style.setProperty("--instruction-col-width", `${Math.ceil(nextWidth)}px`);
}

