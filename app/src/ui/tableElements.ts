export function makeHeader(text: string, className: string): HTMLTableCellElement {
  const th = document.createElement("th");
  th.className = className;
  th.textContent = text;
  return th;
}

export function makeRowButton(text: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `row-btn${extraClass ? ` ${extraClass}` : ""}`;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

export function makeInstructionScrollbarSpacer(): HTMLElement {
  const spacer = document.createElement("div");
  spacer.className = "instruction-scrollbar-spacer";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

