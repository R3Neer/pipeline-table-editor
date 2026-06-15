import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import {
  expectClass,
  expectInstructionRowSelected,
  expectInstructionValue,
  expectOpacity,
  expectRowLabelStyle
} from "../cellAssertions";
import { assertVisibleText, cell, clickRowEditAction, instructionRow } from "../editorDriver";
import {
  expectCycleViewportHasBottomBreathingRoomWhenFull,
  expectCycleViewportHasNoUnneededVerticalScroll,
  expectCycleViewportScrollsHorizontally,
  expectAddRowHoverAutoscrollsAndRestores,
  expectInstructionAndCyclePanesTouch,
  expectInstructionAndCycleRowsAligned
} from "../layoutAssertions";
import {
  expectAssemblyOverlayUsesInputMetrics,
  expectCustomScrollbarTheme,
  expectCustomTextareaResizeHandle,
  expectFloatingMenusStayInsideViewport,
  expectInstructionButtonsDoNotOverlap,
  expectInstructionButtonsHaveBreathingRoom
} from "../presentationAssertions";

export async function runSetupLayoutAndRowsScenario(page: Page) {
  await assertVisibleText(page, "Pipeline Table Editor");
  assert.equal(await page.locator("#openArrowsBtn").count(), 0);
  assert.equal(await page.locator("#toggleSidebarBtn").count(), 0);
  assert.equal((await page.locator("#saveStatus").textContent()).trim(), "");
  await page.click("#collapseSidebarBtn");
  await page.waitForSelector(".layout.sidebar-collapsed");
  await page.click("#expandSidebarBtn");
  await page.waitForSelector(".layout:not(.sidebar-collapsed)");

  await page.fill("#titleInput", "Smoke test");
  await page.fill("#cyclesInput", "6");
  await page.locator("#cyclesInput").dispatchEvent("change");
  await page.fill("#instructionsInput", [
    "flw f10, 0(x1)",
    "fmul.s f4, f0, f10",
    "fadd.s f2, f12, f4"
  ].join("\n"));
  await page.waitForSelector('.stage-input[data-row="2"][data-cycle="0"]');
  await page.fill("#cyclesInput", "25");
  await page.locator("#cyclesInput").dispatchEvent("change");
  await expectCycleViewportScrollsHorizontally(page);
  await expectInstructionAndCycleRowsAligned(page);
  await expectCycleViewportHasNoUnneededVerticalScroll(page);
  await expectCycleViewportHasBottomBreathingRoomWhenFull(page);
  await expectAddRowHoverAutoscrollsAndRestores(page);
  await expectInstructionAndCyclePanesTouch(page);
  await expectInstructionButtonsHaveBreathingRoom(page);
  await expectInstructionButtonsDoNotOverlap(page);
  await expectCustomScrollbarTheme(page);
  await page.fill("#cyclesInput", "6");
  await page.locator("#cyclesInput").dispatchEvent("change");
  await page.waitForSelector('.stage-input[data-row="2"][data-cycle="5"]');
  assert.equal(await page.locator(".asm-token-instruction").first().textContent(), "flw");
  assert.deepEqual(
    await page
      .locator("tbody tr:first-child .instruction-cell .asm-token-register")
      .evaluateAll((items) => items.map((item) => item.textContent)),
    ["f10", "x1"]
  );
  await expectAssemblyOverlayUsesInputMetrics(page);
  await expectCustomTextareaResizeHandle(page);
  await expectFloatingMenusStayInsideViewport(page);

  await instructionRow(page, 1).click({ button: "right" });
  await page.locator('#rowMenu [data-row-action="edit-label"]').getByText("Add label").waitFor({ state: "visible" });
  await page.locator('#rowMenu [data-row-action="edit-label"]').click();
  await page.waitForSelector("#labelModal:not([aria-hidden='true'])");
  await page.fill("#labelInput", "loop");
  await page.click("#saveLabelBtn");
  await page.getByText("loop:").first().waitFor({ state: "visible" });
  await expectRowLabelStyle(page, "loop:");
  await instructionRow(page, 1).click({ button: "right" });
  await page.locator('#rowMenu [data-row-action="edit-label"]').getByText("Edit label").waitFor({ state: "visible" });
  await page.locator('#rowMenu [data-row-action="edit-label"]').click();
  await page.waitForSelector("#labelModal:not([aria-hidden='true'])");
  assert.equal(await page.locator("#labelModalTitle").textContent(), "Edit label");
  assert.equal(await page.inputValue("#labelInput"), "loop");
  await page.click("#cancelLabelBtn");
  await page.keyboard.press("Escape");
  await instructionRow(page, 1).click({ button: "right" });
  await page.locator('#rowMenu [data-row-action="toggle-separator"]').click();
  await page.waitForSelector(".instruction-table tbody tr:nth-child(2).row-separator");
  await page.waitForSelector(".cycle-table tbody tr:nth-child(2).row-separator");
  await instructionRow(page, 1).click({ button: "right" });
  await page.locator('#rowMenu [data-row-action="remove-label"]').click();
  await page.waitForFunction(() => ![...document.querySelectorAll(".row-label")].some((item) => item.textContent === "loop"));
  await instructionRow(page, 1).click({ button: "right" });
  await clickRowEditAction(page, "copy");
  await instructionRow(page, 2).click({ button: "right" });
  await clickRowEditAction(page, "paste");
  await expectInstructionValue(page, 2, "fmul.s f4, f0, f10");
  await instructionRow(page, 2).click({ button: "right" });
  await clickRowEditAction(page, "clear");
  await expectInstructionValue(page, 2, "");
  await page.fill('.assembly-input[data-row="2"]', "fadd.s f2, f12, f4");

  assert.equal(await page.locator("#exportJsonBtn").count(), 0);
  assert.equal(await page.locator("#exportMarkdownBtn").count(), 0);
  assert.equal(await page.locator("#exportTextBtn").count(), 0);
  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="png"]').waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator("#tableShell").hover({ position: { x: 800, y: 120 } });
  await expectOpacity(page, ".add-row-zone", "0");
  await page.locator(".add-row-zone").hover();
  await expectOpacity(page, ".add-row-zone", "1");
  await page.click("#addRowInlineBtn");
  await page.waitForSelector('.stage-input[data-row="3"][data-cycle="0"]');
  await page.click('tbody tr:nth-child(4) .row-delete-button');
  await page.waitForFunction(() => !document.querySelector('.stage-input[data-row="3"][data-cycle="0"]'));
  await instructionRow(page, 0).click();
  await instructionRow(page, 1).click({ modifiers: ["Shift"] });
  await page.locator("#autocompleteMenu").waitFor({ state: "hidden" });
  await expectInstructionRowSelected(page, 0);
  await expectInstructionRowSelected(page, 1);
  await instructionRow(page, 0).click({ button: "right" });
  await page.locator('#rowMenu [data-row-action="edit-label"]').waitFor({ state: "hidden" });
  await page.locator('#rowMenu [data-row-action="toggle-separator"]').waitFor({ state: "hidden" });
  await page.locator('#rowMenu [data-row-action="copy"]').waitFor({ state: "hidden" });
  await page.locator('#rowMenu [data-row-action="cut"]').waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await cell(page, 0, 0).click();
  await expectClass(page, 0, 0, "selected");
}
