export interface SplitTableElements {
  tableShell: HTMLElement;
  instructionMount: HTMLElement;
  tableMount: HTMLElement;
  cycleViewport: HTMLElement;
}

export interface SplitTableController {
  attach(): void;
  syncLayout(): void;
}

const nativeScrollbarReserve = 18;
const bottomScrollRows = 1.5;
const smoothWheelDurationMs = 150;

export function createSplitTableController(elements: SplitTableElements, onScroll: () => void): SplitTableController {
  let smoothScrollTarget = 0;
  let smoothScrollStart = 0;
  let smoothScrollStartedAt = 0;
  let smoothScrollFrame = 0;

  function syncLayout(): void {
    syncTableRowHeights(elements);
    updateCycleViewportOverflow(elements);
  }

  function attach(): void {
    elements.tableShell.addEventListener("scroll", onScroll);
    elements.cycleViewport.addEventListener("scroll", onScroll);
    elements.tableShell.addEventListener("wheel", onTableWheel, { passive: false });
  }

  function onTableWheel(event: WheelEvent): void {
    if (!event.deltaY || !elements.tableShell.classList.contains("has-vertical-overflow")) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    event.preventDefault();
    const maxScrollTop = elements.tableShell.scrollHeight - elements.tableShell.clientHeight;
    const currentTarget = smoothScrollFrame ? smoothScrollTarget : elements.tableShell.scrollTop;
    smoothScrollStart = elements.tableShell.scrollTop;
    smoothScrollTarget = clamp(currentTarget + normalizeWheelDelta(event, elements.tableShell), 0, maxScrollTop);
    smoothScrollStartedAt = performance.now();

    if (!smoothScrollFrame) {
      smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
    }
  }

  function stepSmoothScroll(now: number): void {
    const progress = clamp((now - smoothScrollStartedAt) / smoothWheelDurationMs, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    elements.tableShell.scrollTop = smoothScrollStart + (smoothScrollTarget - smoothScrollStart) * eased;
    onScroll();

    if (progress < 1 && Math.abs(elements.tableShell.scrollTop - smoothScrollTarget) > 0.5) {
      smoothScrollFrame = window.requestAnimationFrame(stepSmoothScroll);
      return;
    }

    elements.tableShell.scrollTop = smoothScrollTarget;
    smoothScrollFrame = 0;
    onScroll();
  }

  return { attach, syncLayout };
}

function normalizeWheelDelta(event: WheelEvent, element: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * readCssPixelVariable(element, "--table-row-height", 60) * 0.45;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * element.clientHeight * 0.85;
  }
  return event.deltaY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function syncTableRowHeights(elements: SplitTableElements): void {
  const instructionHead = elements.instructionMount.querySelector<HTMLTableRowElement>(".instruction-table thead tr");
  const cycleHead = elements.tableMount.querySelector<HTMLTableRowElement>(".cycle-table thead tr");
  syncElementPairHeight(instructionHead, cycleHead);

  const instructionRows = elements.instructionMount.querySelectorAll<HTMLTableRowElement>(".instruction-table tbody tr");
  const cycleRows = elements.tableMount.querySelectorAll<HTMLTableRowElement>(".cycle-table tbody tr");
  instructionRows.forEach((instructionRow, index) => {
    syncElementPairHeight(instructionRow, cycleRows[index] || null);
  });
}

function updateCycleViewportOverflow(elements: SplitTableElements): void {
  const cycleTable = elements.tableMount.querySelector<HTMLElement>(".cycle-table");
  const contentHeight = cycleTable?.getBoundingClientRect().height || 0;
  const availableHeight = elements.tableShell.clientHeight;
  const hasHorizontalOverflow = Boolean(cycleTable && cycleTable.getBoundingClientRect().width > elements.cycleViewport.clientWidth + 1);
  const horizontalScrollbarHeight = hasHorizontalOverflow ? nativeScrollbarReserve : 0;
  const desiredCycleHeight = Math.ceil(contentHeight + horizontalScrollbarHeight);
  const rowHeight = readCssPixelVariable(elements.tableShell, "--table-row-height", 60);
  const bottomReserve = rowHeight * bottomScrollRows;
  const contentNeedsVerticalScroll = Math.max(desiredCycleHeight, elements.instructionMount.scrollHeight) + bottomReserve > availableHeight + 1;

  elements.cycleViewport.style.height = `${desiredCycleHeight}px`;
  elements.instructionMount.style.height = "";
  elements.tableShell.classList.toggle("has-vertical-overflow", contentNeedsVerticalScroll);
  elements.tableShell.classList.toggle("has-horizontal-overflow", hasHorizontalOverflow);
  elements.tableShell.style.setProperty("--table-bottom-scroll-reserve", `${contentNeedsVerticalScroll ? bottomReserve : 0}px`);
  elements.tableShell.style.setProperty("--cycle-horizontal-scrollbar-reserve", `${horizontalScrollbarHeight}px`);

  if (!contentNeedsVerticalScroll) {
    elements.tableShell.scrollTop = 0;
  }
}

function readCssPixelVariable(element: HTMLElement, name: string, fallback: number): number {
  const rawValue = window.getComputedStyle(element).getPropertyValue(name).trim();
  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function syncElementPairHeight(first: HTMLElement | null, second: HTMLElement | null): void {
  if (!first || !second) return;
  first.style.height = "";
  second.style.height = "";
  const height = Math.max(first.getBoundingClientRect().height, second.getBoundingClientRect().height);
  first.style.height = `${height}px`;
  second.style.height = `${height}px`;
}
