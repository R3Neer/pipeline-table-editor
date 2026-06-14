export interface SplitTableElements {
  tableShell: HTMLElement;
  instructionMount: HTMLElement;
  tableMount: HTMLElement;
  cycleViewport: HTMLElement;
}

export interface SplitTableController {
  attach(): void;
  syncLayout(): void;
  syncInstructionScroll(): void;
}

const nativeScrollbarReserve = 18;

export function createSplitTableController(elements: SplitTableElements, onScroll: () => void): SplitTableController {
  function syncInstructionScroll(): void {
    elements.instructionMount.scrollTop = elements.cycleViewport.scrollTop;
  }

  function syncLayout(): void {
    syncTableRowHeights(elements);
    updateCycleViewportOverflow(elements);
    syncInstructionScroll();
  }

  function attach(): void {
    elements.cycleViewport.addEventListener("scroll", () => {
      syncInstructionScroll();
      onScroll();
    });
    elements.instructionMount.addEventListener(
      "wheel",
      (event) => {
        if (!event.deltaY) return;
        event.preventDefault();
        elements.cycleViewport.scrollTop += event.deltaY;
        syncInstructionScroll();
        onScroll();
      },
      { passive: false }
    );
  }

  return { attach, syncLayout, syncInstructionScroll };
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
  const desiredHeight = Math.ceil(contentHeight + nativeScrollbarReserve);
  const shouldScrollVertically = desiredHeight > availableHeight + 1;

  elements.cycleViewport.style.height = shouldScrollVertically ? `${Math.max(0, availableHeight)}px` : `${desiredHeight}px`;
  elements.cycleViewport.classList.toggle("has-vertical-overflow", shouldScrollVertically);
  elements.tableShell.classList.toggle("has-vertical-overflow", shouldScrollVertically);
  const horizontalScrollbarHeight = shouldScrollVertically
    ? Math.max(0, elements.cycleViewport.offsetHeight - elements.cycleViewport.clientHeight)
    : 0;
  elements.tableShell.style.setProperty("--cycle-horizontal-scrollbar-reserve", `${horizontalScrollbarHeight}px`);
}

function syncElementPairHeight(first: HTMLElement | null, second: HTMLElement | null): void {
  if (!first || !second) return;
  first.style.height = "";
  second.style.height = "";
  const height = Math.max(first.getBoundingClientRect().height, second.getBoundingClientRect().height);
  first.style.height = `${height}px`;
  second.style.height = `${height}px`;
}
