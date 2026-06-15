import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { cell } from "./editorDriver";

export async function expectCycleViewportScrollsHorizontally(page: Page) {
  const result = await page.evaluate(() => {
    const viewport = document.querySelector("#cycleViewport");
    const instruction = document.querySelector(".instruction-cell");
    const firstCycle = document.querySelector('.stage-input[data-row="0"][data-cycle="0"]');
    if (!(viewport instanceof HTMLElement) || !(instruction instanceof HTMLElement) || !(firstCycle instanceof HTMLElement)) {
      return null;
    }

    const instructionLeftBefore = instruction.getBoundingClientRect().left;
    const cycleLeftBefore = firstCycle.getBoundingClientRect().left;
    viewport.scrollLeft = 240;
    const instructionLeftAfter = instruction.getBoundingClientRect().left;
    const cycleLeftAfter = firstCycle.getBoundingClientRect().left;

    return {
      scrollLeft: viewport.scrollLeft,
      canScroll: viewport.scrollWidth > viewport.clientWidth,
      instructionDelta: Math.round(instructionLeftAfter - instructionLeftBefore),
      cycleDelta: Math.round(cycleLeftAfter - cycleLeftBefore)
    };
  });

  assert.ok(result);
  assert.equal(result.canScroll, true);
  assert.ok(result.scrollLeft > 0);
  assert.equal(result.instructionDelta, 0);
  assert.ok(result.cycleDelta < 0);
}

export async function expectInstructionAndCycleRowsAligned(page: Page) {
  const result = await page.evaluate(() => {
    const instructionRows = [...document.querySelectorAll(".instruction-table tbody tr")];
    const cycleRows = [...document.querySelectorAll(".cycle-table tbody tr")];
    return instructionRows.map((row, index) => {
      const cycleRow = cycleRows[index];
      const rowRect = row.getBoundingClientRect();
      const cycleRect = cycleRow.getBoundingClientRect();
      return {
        topDelta: Math.abs(rowRect.top - cycleRect.top),
        heightDelta: Math.abs(rowRect.height - cycleRect.height)
      };
    });
  });

  assert.ok(result.length > 0);
  result.forEach(({ topDelta, heightDelta }) => {
    assert.ok(topDelta <= 1);
    assert.ok(heightDelta <= 1);
  });
}

export async function expectCycleViewportHasNoUnneededVerticalScroll(page: Page) {
  const result = await page.evaluate(() => {
    const viewport = document.querySelector("#cycleViewport");
    const shell = document.querySelector("#tableShell");
    if (!(viewport instanceof HTMLElement) || !(shell instanceof HTMLElement)) return null;
    return {
      viewportHasVerticalOverflow: viewport.scrollHeight > viewport.clientHeight + 1,
      shellHasVerticalOverflow: shell.classList.contains("has-vertical-overflow")
    };
  });

  assert.ok(result);
  assert.equal(result.viewportHasVerticalOverflow, false);
  assert.equal(result.shellHasVerticalOverflow, false);
}

export async function expectCycleViewportHasBottomBreathingRoomWhenFull(page: Page) {
  const originalInstructions = [
    "flw f10, 0(x1)",
    "fmul.s f4, f0, f10",
    "fadd.s f2, f12, f4"
  ].join("\n");
  const manyInstructions = Array.from({ length: 18 }, (_, index) => `addi x${index + 1}, x${index + 1}, ${index}`).join("\n");
  await page.fill("#instructionsInput", manyInstructions);
  await page.waitForSelector('.stage-input[data-row="17"][data-cycle="0"]');

  const result = await page.evaluate(() => {
    const shell = document.querySelector("#tableShell");
    const lastRow = document.querySelector(".cycle-table tbody tr:last-child");
    const lastInstructionRow = document.querySelector(".instruction-table tbody tr:last-child");
    if (!(shell instanceof HTMLElement) || !(lastRow instanceof HTMLElement) || !(lastInstructionRow instanceof HTMLElement)) {
      return null;
    }
    shell.scrollTop = shell.scrollHeight;
    shell.dispatchEvent(new Event("scroll"));
    const viewportRect = shell.getBoundingClientRect();
    const lastRowRect = lastRow.getBoundingClientRect();
    const lastInstructionRowRect = lastInstructionRow.getBoundingClientRect();
    const rowHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--table-row-height"));
    const instructionRows = [...document.querySelectorAll(".instruction-table tbody tr")];
    const cycleRows = [...document.querySelectorAll(".cycle-table tbody tr")];
    const visibleDeltas = instructionRows.flatMap((instructionRow, index) => {
      const cycleRow = cycleRows[index];
      if (!cycleRow) return [];
      const instructionRect = instructionRow.getBoundingClientRect();
      const cycleRect = cycleRow.getBoundingClientRect();
      const visible = cycleRect.bottom > viewportRect.top && cycleRect.top < viewportRect.bottom;
      return visible ? [Math.abs(instructionRect.top - cycleRect.top), Math.abs(instructionRect.bottom - cycleRect.bottom)] : [];
    });
    return {
      gap: viewportRect.bottom - lastRowRect.bottom,
      hasVerticalOverflow: shell.classList.contains("has-vertical-overflow"),
      bottomDelta: Math.abs(lastInstructionRowRect.bottom - lastRowRect.bottom),
      topDelta: Math.abs(lastInstructionRowRect.top - lastRowRect.top),
      maxVisibleDelta: Math.max(0, ...visibleDeltas),
      rowHeight
    };
  });

  assert.ok(result);
  assert.equal(result.hasVerticalOverflow, true);
  assert.ok(result.gap >= result.rowHeight);
  assert.ok(result.topDelta <= 1);
  assert.ok(result.bottomDelta <= 1);
  assert.ok(result.maxVisibleDelta <= 1);

  await page.evaluate(() => {
    const shell = document.querySelector("#tableShell");
    if (shell instanceof HTMLElement) shell.scrollTop = 0;
  });
  await page.locator("#instructionMount").hover({ position: { x: 20, y: 220 } });
  await page.mouse.wheel(0, 360);
  await page.waitForFunction(() => {
    const shell = document.querySelector("#tableShell");
    return shell instanceof HTMLElement && shell.scrollTop > 0;
  });
  const syncedScroll = await page.evaluate(() => {
    const shell = document.querySelector("#tableShell");
    const firstInstructionRow = document.querySelector(".instruction-table tbody tr:first-child");
    const firstCycleRow = document.querySelector(".cycle-table tbody tr:first-child");
    if (!(shell instanceof HTMLElement) || !(firstInstructionRow instanceof HTMLElement) || !(firstCycleRow instanceof HTMLElement)) {
      return null;
    }
    return {
      shellScrollTop: shell.scrollTop,
      firstRowDelta: Math.abs(firstInstructionRow.getBoundingClientRect().top - firstCycleRow.getBoundingClientRect().top)
    };
  });
  assert.ok(syncedScroll);
  assert.ok(syncedScroll.shellScrollTop > 0);
  assert.ok(syncedScroll.firstRowDelta <= 1);

  await page.fill("#instructionsInput", originalInstructions);
  await page.waitForSelector('.stage-input[data-row="2"][data-cycle="0"]');
  await expectHorizontalScrollbarAttachedToTable(page);
}

export async function expectAddRowHoverAutoscrollsAndRestores(page: Page) {
  const originalInstructions = await page.inputValue("#instructionsInput");
  const manyInstructions = Array.from({ length: 18 }, (_, index) => `addi x${index + 1}, x${index + 1}, ${index}`).join("\n");
  await page.fill("#instructionsInput", manyInstructions);
  await page.waitForSelector('.stage-input[data-row="17"][data-cycle="0"]');

  const result = await page.evaluate(() => {
    const shell = document.querySelector("#tableShell");
    const zone = document.querySelector(".add-row-zone");
    const button = document.querySelector("#addRowInlineBtn");
    if (!(shell instanceof HTMLElement) || !(zone instanceof HTMLElement) || !(button instanceof HTMLElement)) return null;

    const maxScroll = shell.scrollHeight - shell.clientHeight;
    const targetTop = Math.max(0, Math.min(maxScroll - 1, zone.offsetTop - shell.clientHeight + 8));
    shell.scrollTop = targetTop;

    const beforeTop = shell.scrollTop;
    const beforeButtonBottom = button.getBoundingClientRect().bottom;
    const shellBottom = shell.getBoundingClientRect().bottom;
    zone.dispatchEvent(new MouseEvent("mouseenter"));
    const revealedTop = shell.scrollTop;
    const revealedButtonBottom = button.getBoundingClientRect().bottom;
    zone.dispatchEvent(new MouseEvent("mouseleave"));
    const restoredTop = shell.scrollTop;

    return {
      beforeTop,
      revealedTop,
      restoredTop,
      wasCutOrTight: beforeButtonBottom > shellBottom - 12,
      fitsAfterReveal: revealedButtonBottom <= shellBottom - 11
    };
  });

  assert.ok(result);
  assert.equal(result.wasCutOrTight, true);
  assert.ok(result.revealedTop > result.beforeTop);
  assert.equal(result.fitsAfterReveal, true);
  assert.equal(result.restoredTop, result.beforeTop);

  await page.fill("#instructionsInput", originalInstructions);
  await page.waitForSelector('.stage-input[data-row="2"][data-cycle="0"]');
}

export async function expectHorizontalScrollbarAttachedToTable(page: Page) {
  const result = await page.evaluate(() => {
    const viewport = document.querySelector("#cycleViewport");
    const shell = document.querySelector("#tableShell");
    const cycleTable = document.querySelector(".cycle-table");
    const instructionSpacer = document.querySelector(".instruction-scrollbar-spacer");
    if (
      !(viewport instanceof HTMLElement) ||
      !(shell instanceof HTMLElement) ||
      !(cycleTable instanceof HTMLElement) ||
      !(instructionSpacer instanceof HTMLElement)
    ) {
      return null;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const tableRect = cycleTable.getBoundingClientRect();
    const spacerRect = instructionSpacer.getBoundingClientRect();
    return {
      gap: viewportRect.bottom - tableRect.bottom,
      hasVerticalOverflow: shell.classList.contains("has-vertical-overflow"),
      spacerHeight: spacerRect.height,
      spacerDisplay: getComputedStyle(instructionSpacer).display
    };
  });

  assert.ok(result);
  assert.equal(result.hasVerticalOverflow, false);
  assert.ok(result.gap <= 24);
  assert.ok(result.spacerHeight > 0);
  assert.notEqual(result.spacerDisplay, "none");
}

export async function expectInstructionAndCyclePanesTouch(page: Page) {
  const result = await page.evaluate(() => {
    const instructionPane = document.querySelector("#instructionMount");
    const cycleViewport = document.querySelector("#cycleViewport");
    if (!(instructionPane instanceof HTMLElement) || !(cycleViewport instanceof HTMLElement)) return null;
    return Math.abs(instructionPane.getBoundingClientRect().right - cycleViewport.getBoundingClientRect().left);
  });

  assert.ok(result !== null);
  assert.ok(result <= 1);
}

export async function expectArrowHoverUsesArrowColor(page: Page, row: number, cycle: number) {
  await page.waitForFunction(
    ({ row, cycle }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      if (!(input instanceof HTMLElement)) return false;
      const probe = document.createElement("span");
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--accent");
      document.body.appendChild(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(input).borderColor === accent;
    },
    { row, cycle }
  );
}
