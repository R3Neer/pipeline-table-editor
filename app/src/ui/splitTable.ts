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

export function createSplitTableController(elements: SplitTableElements, onScroll: () => void): SplitTableController {
  function syncLayout(): void {
    syncTableRowHeights(elements);
    updateCycleViewportOverflow(elements);
  }

  function attach(): void {
    elements.tableShell.addEventListener("scroll", onScroll);
    elements.cycleViewport.addEventListener("scroll", onScroll);
    elements.instructionMount.addEventListener(
      "wheel",
      (event) => {
        if (!event.deltaY) return;
        event.preventDefault();
        elements.tableShell.scrollTop += event.deltaY;
        onScroll();
      },
      { passive: false }
    );
  }

  return { attach, syncLayout };
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
