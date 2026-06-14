const viewportPadding = 8;
const floatingGap = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function placeFloatingElement(element: HTMLElement, x: number, y: number): void {
  const rect = element.getBoundingClientRect();
  element.style.left = `${clamp(x, viewportPadding, window.innerWidth - rect.width - viewportPadding)}px`;
  element.style.top = `${clamp(y, viewportPadding, window.innerHeight - rect.height - viewportPadding)}px`;
}

export function placeDropdown(element: HTMLElement, anchor: DOMRect, minWidth: number): void {
  element.style.width = `${Math.max(anchor.width, minWidth)}px`;

  const rect = element.getBoundingClientRect();
  const below = anchor.bottom + floatingGap;
  const above = anchor.top - rect.height - floatingGap;
  const fitsBelow = below + rect.height <= window.innerHeight - viewportPadding;
  const preferredTop = fitsBelow ? below : above;

  element.style.left = `${clamp(anchor.left, viewportPadding, window.innerWidth - rect.width - viewportPadding)}px`;
  element.style.top = `${clamp(preferredTop, viewportPadding, window.innerHeight - rect.height - viewportPadding)}px`;
}

export function placeSubmenu(trigger: HTMLElement, panel: HTMLElement): "left" | "right" {
  const previousDisplay = panel.style.display;
  const previousVisibility = panel.style.visibility;

  panel.style.position = "fixed";
  panel.style.display = "block";
  panel.style.visibility = "hidden";

  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const fitsRight = triggerRect.right + floatingGap + panelRect.width <= window.innerWidth - viewportPadding;
  const side = fitsRight ? "right" : "left";
  const preferredLeft =
    side === "right" ? triggerRect.right + floatingGap : triggerRect.left - panelRect.width - floatingGap;

  panel.style.left = `${clamp(preferredLeft, viewportPadding, window.innerWidth - panelRect.width - viewportPadding)}px`;
  panel.style.top = `${clamp(triggerRect.top - floatingGap, viewportPadding, window.innerHeight - panelRect.height - viewportPadding)}px`;
  panel.style.visibility = previousVisibility;
  panel.style.display = previousDisplay;

  return side;
}
