import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium, type Dialog, type Page } from "playwright-core";

const defaultChromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromePath = process.env.CHROME_PATH || (existsSync(defaultChromePath) ? defaultChromePath : "");

const port = process.env.SMOKE_PORT || "5175";
const appUrl = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
  stdio: "inherit"
});

await waitForServer(appUrl);

const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : { channel: "chrome" }),
  headless: process.env.HEADLESS !== "false"
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

try {
  await page.goto(appUrl);
  await page.waitForSelector(".pipeline-table");
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await page.waitForSelector(".pipeline-table");

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

  await fillCell(page, 0, 0, "if");
  assert.equal(await cell(page, 0, 0).inputValue(), "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 0, 3, "MEM");
  await fillCell(page, 0, 4, "WB");
  await fillCell(page, 1, 1, "IF");
  await fillCell(page, 1, 2, "idp");
  assert.equal(await cell(page, 1, 2).inputValue(), "IDp");
  await fillCell(page, 1, 3, "ID");
  await fillCell(page, 1, 4, "EX1");
  await fillCell(page, 2, 0, "EXp1");

  await expectClass(page, 0, 0, "stage-if");
  await expectClass(page, 1, 2, "stage-id");
  await expectClass(page, 1, 2, "stage-p");
  await expectClass(page, 1, 4, "stage-ex");
  await expectClass(page, 2, 0, "stage-invalid");

  await fillCell(page, 1, 2, "IDp");
  await fillCell(page, 1, 3, "IDp");
  await fillCell(page, 1, 4, "ID");
  await expectClass(page, 1, 2, "stage-p");
  await expectNoClass(page, 1, 2, "stage-invalid");
  await expectClass(page, 1, 3, "stage-p");
  await expectNoClass(page, 1, 3, "stage-invalid");
  await fillCell(page, 1, 4, "");
  await expectNoClass(page, 1, 2, "stage-invalid");
  await expectNoClass(page, 1, 3, "stage-invalid");
  await fillCell(page, 1, 4, "EX");
  await expectClass(page, 1, 2, "stage-invalid");
  await expectClass(page, 1, 3, "stage-invalid");
  await fillCell(page, 1, 3, "ID");
  await fillCell(page, 1, 4, "EX1");

  await fillCell(page, 0, 0, "IF1");
  await fillCell(page, 0, 1, "IF2p");
  await fillCell(page, 0, 2, "IF2p");
  await fillCell(page, 1, 0, "IF1");
  await fillCell(page, 1, 1, "IF2p");
  await fillCell(page, 1, 2, "IF2p");
  await cell(page, 1, 2).click();
  await assertVisibleText(page, "IF2p");
  assert.equal(await autocompleteHasExactOption(page, "IF2p"), true);
  assert.equal(await autocompleteHasExactOption(page, "IFp"), false);
  assert.equal(await autocompleteHasExactOption(page, "ID"), false);
  assert.equal(await autocompleteHasExactOption(page, "ID1"), false);
  assert.equal(await autocompleteHasExactOption(page, "IDp"), false);
  await page.keyboard.press("Escape");
  await fillCell(page, 1, 2, "");
  await cell(page, 1, 2).click();
  await assertVisibleText(page, "IF2p");
  assert.equal(await autocompleteHasExactOption(page, "IF2p"), true);
  assert.equal(await autocompleteHasExactOption(page, "IFp"), false);
  assert.equal(await autocompleteHasExactOption(page, "ID"), false);
  assert.equal(await autocompleteHasExactOption(page, "ID1"), false);
  assert.equal(await autocompleteHasExactOption(page, "IDp"), false);
  await page.keyboard.press("Escape");
  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 1, 0, "");
  await fillCell(page, 1, 1, "IF");
  await fillCell(page, 1, 2, "IDp");
  await fillCell(page, 1, 3, "ID");
  await fillCell(page, 1, 4, "EX1");

  await fillCell(page, 0, 0, "IFp");
  await fillCell(page, 0, 1, "IF");
  await fillCell(page, 1, 0, "IF");
  await expectClass(page, 1, 0, "stage-invalid");
  await fillCell(page, 1, 0, "IFp");
  await fillCell(page, 1, 1, "IF");
  await expectClass(page, 1, 0, "stage-p");
  await fillCell(page, 2, 0, "IF");
  await expectClass(page, 2, 0, "stage-invalid");
  await fillCell(page, 2, 0, "");
  await cell(page, 2, 0).click();
  await assertVisibleText(page, "IFp");
  assert.equal(await autocompleteHasExactOption(page, "IF"), false);
  await page.keyboard.press("Escape");
  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 1, 0, "");
  await fillCell(page, 2, 0, "IF");
  await expectClass(page, 2, 0, "stage-if");

  await fillCell(page, 0, 2, "IF");
  await expectClass(page, 0, 2, "stage-invalid");
  await fillCell(page, 0, 2, "EX");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "ID");
  await fillCell(page, 2, 2, "MEM");
  await expectClass(page, 2, 2, "stage-invalid");
  await fillCell(page, 2, 2, "EX");
  await fillCell(page, 2, 3, "MEM");
  await expectClass(page, 2, 3, "stage-invalid");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "MEM");
  await fillCell(page, 2, 2, "EX");
  await fillCell(page, 2, 3, "MEM");
  await fillCell(page, 2, 4, "WB");
  await expectClass(page, 2, 1, "stage-invalid");
  await expectClass(page, 2, 2, "stage-invalid");
  await expectClass(page, 2, 3, "stage-invalid");
  await expectClass(page, 2, 4, "stage-invalid");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");
  await fillCell(page, 2, 4, "");

  await fillCell(page, 2, 0, "IF");
  await cell(page, 2, 1).click();
  await assertVisibleText(page, "ID");
  assert.equal(await autocompleteHasOption(page, "WB"), false);
  await page.keyboard.press("Escape");
  await fillCell(page, 2, 1, "ID");
  await fillCell(page, 2, 2, "EX");
  await cell(page, 2, 3).click();
  await assertVisibleText(page, "MEM");
  assert.equal(await autocompleteHasOption(page, "WB"), false);
  await page.keyboard.press("Escape");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 0, "EXp1");

  await fillCell(page, 1, 5, "ex");
  await assertVisibleText(page, "EX2");
  assert.equal(await autocompleteHasOption(page, "EX2p"), false);
  await page.keyboard.press("Enter");
  assert.equal(await cell(page, 1, 5).inputValue(), "EX2");
  await page.locator("#autocompleteMenu").waitFor({ state: "hidden" });
  await fillCell(page, 1, 5, "");
  await cell(page, 1, 5).click();
  await page.locator("#autocompleteMenu").waitFor({ state: "visible" });
  await page.keyboard.press("Tab");
  assert.equal(await cell(page, 1, 5).inputValue(), "EX2");
  await fillCell(page, 1, 5, "EX2");
  await page.keyboard.press("Tab");
  assert.equal(await cell(page, 1, 5).inputValue(), "EX2");
  await fillCell(page, 1, 5, "EX2p");
  assert.equal(await cell(page, 1, 5).inputValue(), "EX2p");
  await expectClass(page, 1, 5, "stage-p");
  await expectNoClass(page, 1, 5, "stage-invalid");
  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "ID");
  await fillCell(page, 2, 2, "EX1");
  await fillCell(page, 2, 3, "EX2p");
  await fillCell(page, 2, 4, "EX2");
  await expectClass(page, 2, 3, "stage-p");
  await fillCell(page, 2, 0, "EXp1");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");
  await fillCell(page, 2, 4, "");
  await fillCell(page, 2, 1, "MEM2p");
  await expectClass(page, 2, 1, "stage-invalid");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 1, 5, "ex");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  assert.equal(await cell(page, 1, 5).inputValue(), "EX1");

  await fillCell(page, 0, 0, "EX");
  await cell(page, 0, 0).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  await expectClass(page, 0, 0, "expand-from");
  await cell(page, 0, 2).click();
  await page.locator("#confirmModal").waitFor({ state: "visible" });
  await page.locator("#confirmModalTitle").getByText("Overwrite cells").waitFor({ state: "visible" });
  await page.click("#acceptConfirmBtn");
  assert.equal(await cell(page, 0, 0).inputValue(), "EX1");
  assert.equal(await cell(page, 0, 1).inputValue(), "EX2");
  assert.equal(await cell(page, 0, 2).inputValue(), "EX3");

  await fillCell(page, 0, 3, "MEM2");
  await cell(page, 0, 3).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  await cell(page, 0, 5).click();
  await page.locator("#confirmModal").waitFor({ state: "visible" });
  await page.click("#acceptConfirmBtn");
  assert.equal(await cell(page, 0, 3).inputValue(), "MEM2");
  assert.equal(await cell(page, 0, 4).inputValue(), "MEM3");
  assert.equal(await cell(page, 0, 5).inputValue(), "MEM4");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 2, "idp");
  await cell(page, 2, 2).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  await cell(page, 2, 4).click();
  assert.equal(await cell(page, 2, 2).inputValue(), "IDp");
  assert.equal(await cell(page, 2, 3).inputValue(), "IDp");
  assert.equal(await cell(page, 2, 4).inputValue(), "IDp");
  await expectClass(page, 2, 4, "stage-p");
  await expectNoClass(page, 2, 4, "stage-invalid");

  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 0, 3, "MEM");
  await fillCell(page, 0, 4, "WB");
  await fillCell(page, 0, 5, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");
  await fillCell(page, 2, 4, "");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  let rootRenumberDialogShown = false;
  const rootRenumberDialogHandler = (dialog: Dialog) => {
    rootRenumberDialogShown = true;
    dialog.dismiss();
  };
  page.on("dialog", rootRenumberDialogHandler);
  await cell(page, 2, 0).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  await cell(page, 2, 2).click();
  await page.waitForTimeout(250);
  page.off("dialog", rootRenumberDialogHandler);
  assert.equal(rootRenumberDialogShown, false);
  assert.equal(await cell(page, 2, 0).inputValue(), "IF1");
  assert.equal(await cell(page, 2, 1).inputValue(), "IF2");
  assert.equal(await cell(page, 2, 2).inputValue(), "IF3");
  await fillCell(page, 2, 0, "");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");

  await fillCell(page, 0, 0, "IF1");
  await fillCell(page, 0, 1, "IF2");
  await fillCell(page, 0, 2, "IF3");
  let redundantDialogShown = false;
  const redundantDialogHandler = (dialog: Dialog) => {
    redundantDialogShown = true;
    dialog.dismiss();
  };
  page.on("dialog", redundantDialogHandler);
  await cell(page, 0, 0).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  await cell(page, 0, 2).click();
  await page.waitForTimeout(250);
  page.off("dialog", redundantDialogHandler);
  assert.equal(redundantDialogShown, false);
  assert.equal(await cell(page, 0, 0).inputValue(), "IF1");
  assert.equal(await cell(page, 0, 1).inputValue(), "IF2");
  assert.equal(await cell(page, 0, 2).inputValue(), "IF3");

  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 0, 3, "MEM");
  await fillCell(page, 0, 4, "WB");
  await fillCell(page, 0, 5, "");

  await cell(page, 0, 4).click({ button: "right" });
  await page.locator("#cellMenu").getByText("Strike").click();
  await expectClass(page, 0, 4, "stage-struck");
  await cell(page, 0, 4).click({ button: "right" });
  await page.locator("#cellMenu").getByText("Remove strike").waitFor({ state: "visible" });
  await page.locator('#cellMenu [data-action="expand"]').waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");

  await cell(page, 0, 4).click({ button: "right" });
  await clickEditAction(page, "copy");
  await cell(page, 2, 1).click({ button: "right" });
  await clickEditAction(page, "paste");
  assert.equal(await cell(page, 2, 1).inputValue(), "WB");
  await expectClass(page, 2, 1, "stage-struck");
  await cell(page, 2, 1).click({ button: "right" });
  await clickEditAction(page, "clear");
  assert.equal(await cell(page, 2, 1).inputValue(), "");
  await cell(page, 2, 1).click({ button: "right" });
  await page.locator('#cellMenu [data-action="remove-arrows"]').waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");

  await fillCell(page, 2, 1, "ID");
  await cell(page, 2, 1).click({ button: "right" });
  await clickEditAction(page, "cut");
  assert.equal(await cell(page, 2, 1).inputValue(), "");
  await cell(page, 2, 2).click({ button: "right" });
  await clickEditAction(page, "paste");
  assert.equal(await cell(page, 2, 2).inputValue(), "ID");
  await cell(page, 2, 2).click({ button: "right" });
  await clickEditAction(page, "clear");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "ID");
  await fillCell(page, 2, 2, "EX");
  await cell(page, 2, 0).click();
  await cell(page, 2, 2).click({ modifiers: ["Shift"] });
  await expectClass(page, 2, 0, "multi-selected");
  await expectClass(page, 2, 1, "multi-selected");
  await expectClass(page, 2, 2, "multi-selected");
  await page.locator("#autocompleteMenu").waitFor({ state: "hidden" });
  await cell(page, 2, 1).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').waitFor({ state: "hidden" });
  await page.locator('#cellMenu [data-action="copy"]').waitFor({ state: "hidden" });
  await page.locator('#cellMenu [data-action="cut"]').waitFor({ state: "hidden" });
  await clickEditAction(page, "clear");
  assert.equal(await cell(page, 2, 0).inputValue(), "");
  assert.equal(await cell(page, 2, 1).inputValue(), "");
  assert.equal(await cell(page, 2, 2).inputValue(), "");

  await fillCell(page, 2, 0, "IF");
  await fillCell(page, 2, 1, "ID");
  await cell(page, 2, 0).click();
  await cell(page, 2, 1).click({ modifiers: ["Control"] });
  await expectClass(page, 2, 0, "multi-selected");
  await expectClass(page, 2, 1, "multi-selected");
  await page.locator("#autocompleteMenu").waitFor({ state: "hidden" });

  await cell(page, 0, 5).click();
  await cell(page, 2, 5).click({ modifiers: ["Alt"] });
  await expectClass(page, 0, 5, "multi-selected");
  await expectClass(page, 1, 5, "multi-selected");
  await expectClass(page, 2, 5, "multi-selected");
  await page.locator("#autocompleteMenu").waitFor({ state: "hidden" });
  await fillCell(page, 2, 0, "EXp1");
  await fillCell(page, 2, 1, "");

  await cell(page, 0, 2).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').click();
  await cell(page, 1, 4).hover();
  await expectClass(page, 1, 4, "arrow-target-valid");
  await expectArrowHoverUsesArrowColor(page, 1, 4);
  await cell(page, 0, 1).hover();
  await expectNoClass(page, 0, 1, "arrow-target-valid");
  await cell(page, 0, 1).click();
  await expectNoClass(page, 0, 2, "arrow-from");
  assert.equal(await page.locator("#arrowLayer path.arrow-path").count(), 0);

  await cell(page, 0, 2).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').click();
  await cell(page, 1, 4).click();
  await page.waitForFunction(() => document.querySelectorAll("#arrowLayer path.arrow-path").length === 1);
  await cell(page, 0, 3).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').click();
  await cell(page, 1, 4).hover();
  await expectNoClass(page, 1, 4, "arrow-target-valid");
  await cell(page, 1, 4).click();
  await expectNoClass(page, 0, 3, "arrow-from");
  await page.waitForFunction(() => document.querySelectorAll("#arrowLayer path.arrow-path").length === 1);
  await cell(page, 0, 2).click({ button: "right" });
  await page.locator("#cellMenu").getByText("Strike").click();
  await page.waitForFunction(() => document.querySelectorAll("#arrowLayer path.arrow-path").length === 0);
  await cell(page, 0, 2).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').waitFor({ state: "hidden" });
  await page.locator('#cellMenu [data-action="remove-arrows"]').waitFor({ state: "hidden" });
  await page.locator("#cellMenu").getByText("Remove strike").click();

  await cell(page, 0, 3).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').click();
  await cell(page, 1, 4).click();
  await page.waitForFunction(() => document.querySelectorAll("#arrowLayer path.arrow-path").length === 1);
  await cell(page, 0, 3).click({ button: "right" });
  await page.locator("#cellMenu").getByText("Remove arrows").click();
  await page.waitForFunction(() => document.querySelectorAll("#arrowLayer path.arrow-path").length === 0);
  await cell(page, 0, 3).click({ button: "right" });
  await page.locator('#cellMenu [data-action="arrow"]').click();
  await cell(page, 1, 4).click();

  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="json"]').click();
  await page.waitForSelector("#exportModal:not([aria-hidden='true'])");
  const jsonText = await page.inputValue("#exportOutput");
  const exported = JSON.parse(jsonText);
  assert.equal(exported.title, "Smoke test");
  assert.equal(exported.cycles, 6);
  assert.equal(exported.rows[0].cells[4].struck, true);
  assert.equal(exported.arrows[0].label, "");
  const jsonDownloadPromise = page.waitForEvent("download");
  await page.click("#downloadExportBtn");
  const jsonDownload = await jsonDownloadPromise;
  assert.equal(jsonDownload.suggestedFilename(), "smoke-test.json");
  await page.click("#closeExportBtn");

  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="markdown"]').click();
  const markdown = await page.inputValue("#exportOutput");
  assert.match(markdown, /~~WB~~/);
  assert.match(markdown, /Forwarding/);
  const markdownDownloadPromise = page.waitForEvent("download");
  await page.click("#downloadExportBtn");
  const markdownDownload = await markdownDownloadPromise;
  assert.equal(markdownDownload.suggestedFilename(), "smoke-test.md");
  await page.click("#closeExportBtn");

  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="text"]').click();
  const text = await page.inputValue("#exportOutput");
  assert.match(text, /Forwarding:/);
  const textDownloadPromise = page.waitForEvent("download");
  await page.click("#downloadExportBtn");
  const textDownload = await textDownloadPromise;
  assert.equal(textDownload.suggestedFilename(), "smoke-test.txt");
  await page.click("#closeExportBtn");

  await page.click("#exportMenuBtn");
  const downloadPromise = page.waitForEvent("download");
  await page.locator('#exportMenu [data-export-format="png"]').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "smoke-test.png");

  await page.fill("#importInput", jsonText);
  await page.click("#importBtn");
  await expectClass(page, 0, 4, "stage-struck");
  assert.equal(await page.locator("#arrowLayer path.arrow-path").count(), 1);

  await page.reload();
  await page.waitForSelector(".pipeline-table");
  assert.equal(await page.inputValue("#titleInput"), "Smoke test");
  await expectClass(page, 0, 4, "stage-struck");

  console.log("Browser smoke test passed");
} finally {
  await browser.close();
  server.kill();
}

async function fillCell(page: Page, row: number, cycle: number, value: string) {
  const locator = cell(page, row, cycle);
  await locator.fill(value);
}

function cell(page: Page, row: number, cycle: number) {
  return page.locator(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
}

function instructionRow(page: Page, row: number) {
  return page.locator(`.instruction-table tbody tr:nth-child(${row + 1}) .instruction-cell`);
}

async function expectClass(page: Page, row: number, cycle: number, className: string) {
  await page.waitForFunction(
    ({ row, cycle, className }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      return input && input.classList.contains(className);
    },
    { row, cycle, className }
  );
}

async function expectNoClass(page: Page, row: number, cycle: number, className: string) {
  await page.waitForFunction(
    ({ row, cycle, className }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      return input && !input.classList.contains(className);
    },
    { row, cycle, className }
  );
}

async function expectOpacity(page: Page, selector: string, expected: string) {
  await page.waitForFunction(
    ({ selector, expected }) => getComputedStyle(document.querySelector(selector)).opacity === expected,
    { selector, expected }
  );
}

async function expectCycleViewportScrollsHorizontally(page: Page) {
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

async function expectInstructionAndCycleRowsAligned(page: Page) {
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

async function expectCycleViewportHasNoUnneededVerticalScroll(page: Page) {
  const result = await page.evaluate(() => {
    const viewport = document.querySelector("#cycleViewport");
    const shell = document.querySelector("#tableShell");
    if (!(viewport instanceof HTMLElement) || !(shell instanceof HTMLElement)) return null;
    return {
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      viewportHasVerticalOverflow: viewport.scrollHeight > viewport.clientHeight + 1,
      shellHasVerticalOverflow: shell.classList.contains("has-vertical-overflow")
    };
  });

  assert.ok(result);
  assert.equal(result.viewportHasVerticalOverflow, false);
  assert.equal(result.shellHasVerticalOverflow, false);
}

async function expectCycleViewportHasBottomBreathingRoomWhenFull(page: Page) {
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
      return visible
        ? [
            Math.abs(instructionRect.top - cycleRect.top),
            Math.abs(instructionRect.bottom - cycleRect.bottom)
          ]
        : [];
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

async function expectHorizontalScrollbarAttachedToTable(page: Page) {
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

async function expectInstructionAndCyclePanesTouch(page: Page) {
  const result = await page.evaluate(() => {
    const instructionPane = document.querySelector("#instructionMount");
    const cycleViewport = document.querySelector("#cycleViewport");
    if (!(instructionPane instanceof HTMLElement) || !(cycleViewport instanceof HTMLElement)) return null;
    return Math.abs(instructionPane.getBoundingClientRect().right - cycleViewport.getBoundingClientRect().left);
  });

  assert.ok(result !== null);
  assert.ok(result <= 1);
}

async function expectArrowHoverUsesArrowColor(page: Page, row: number, cycle: number) {
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

async function expectInstructionButtonsHaveBreathingRoom(page: Page) {
  const result = await page.evaluate(() => {
    const editor = document.querySelector(".instruction-cell .assembly-editor");
    const firstButton = document.querySelector(".instruction-cell .row-btn");
    if (!(editor instanceof HTMLElement) || !(firstButton instanceof HTMLElement)) return null;
    return firstButton.getBoundingClientRect().left - editor.getBoundingClientRect().right;
  });

  assert.ok(result !== null);
  assert.ok(result >= 14);
}

async function expectInstructionButtonsDoNotOverlap(page: Page) {
  const gaps = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".instruction-cell")];
    return rows.map((row) => {
      const buttons = [...row.querySelectorAll(".row-btn")].map((button) => button.getBoundingClientRect());
      return buttons.slice(1).map((button, index) => Math.round(button.left - buttons[index].right));
    });
  });

  gaps.flat().forEach((gap) => {
    assert.ok(gap >= 6);
  });
}

async function expectCustomTextareaResizeHandle(page: Page) {
  const result = await page.evaluate(() => {
    const textarea = document.querySelector("#instructionsInput");
    const handle = document.querySelector(".textarea-resize-wrap .textarea-resize-handle");
    if (!(textarea instanceof HTMLTextAreaElement) || !(handle instanceof HTMLElement)) return null;
    return {
      resize: getComputedStyle(textarea).resize,
      handleWidth: handle.getBoundingClientRect().width,
      handleHeight: handle.getBoundingClientRect().height
    };
  });

  assert.ok(result);
  assert.equal(result.resize, "none");
  assert.ok(result.handleWidth >= 12);
  assert.ok(result.handleHeight >= 12);
}

async function expectAssemblyOverlayUsesInputMetrics(page: Page) {
  const result = await page.evaluate(() => {
    const input = document.querySelector(".instruction-cell .assembly-input");
    const instruction = document.querySelector(".instruction-cell .asm-token-instruction");
    const register = document.querySelector(".instruction-cell .asm-token-register");
    if (!(input instanceof HTMLElement) || !(instruction instanceof HTMLElement) || !(register instanceof HTMLElement)) {
      return null;
    }
    return {
      inputWeight: getComputedStyle(input).fontWeight,
      instructionWeight: getComputedStyle(instruction).fontWeight,
      registerWeight: getComputedStyle(register).fontWeight
    };
  });

  assert.ok(result);
  assert.equal(result.instructionWeight, result.inputWeight);
  assert.equal(result.registerWeight, result.inputWeight);
}

async function expectRowLabelStyle(page: Page, text: string) {
  const result = await page
    .locator(".row-label")
    .filter({ hasText: text })
    .evaluate((label) => ({
      text: label.textContent,
      fontStyle: getComputedStyle(label).fontStyle,
      fontWeight: getComputedStyle(label).fontWeight
    }));

  assert.equal(result.text, text);
  assert.equal(result.fontStyle, "italic");
  assert.notEqual(result.fontWeight, "700");
}

async function expectInstructionValue(page: Page, row: number, expected: string) {
  await page.waitForFunction(
    ({ row, expected }) => {
      const input = document.querySelector(`.assembly-input[data-row="${row}"]`);
      return input instanceof HTMLInputElement && input.value === expected;
    },
    { row, expected }
  );
}

async function expectInstructionRowSelected(page: Page, row: number) {
  await page.waitForFunction(
    (row) => document.querySelector(`.instruction-cell[data-row="${row}"]`)?.classList.contains("row-selected"),
    row
  );
}

async function clickRowEditAction(page: Page, action: string) {
  await page.locator("#rowMenu .context-submenu-trigger").hover();
  await page.locator(`#rowMenu [data-row-action="${action}"]`).click();
}

async function expectCustomScrollbarTheme(page: Page) {
  const result = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("div");
    probe.style.cssText = "width:80px;height:80px;overflow:scroll;position:absolute;left:-9999px;";
    document.body.appendChild(probe);
    const scrollbar = getComputedStyle(probe, "::-webkit-scrollbar");
    const thumb = getComputedStyle(probe, "::-webkit-scrollbar-thumb");
    const track = getComputedStyle(probe, "::-webkit-scrollbar-track");
    const output = {
      configuredTrack: root.getPropertyValue("--scrollbar-track").trim(),
      configuredThumb: root.getPropertyValue("--scrollbar-thumb").trim(),
      width: scrollbar.width,
      height: scrollbar.height,
      thumbRadius: thumb.borderRadius,
      thumbBackground: thumb.backgroundColor,
      trackBackground: track.backgroundColor
    };
    probe.remove();
    return output;
  });

  assert.notEqual(result.configuredTrack, "");
  assert.notEqual(result.configuredThumb, "");
  assert.equal(result.width, "16px");
  assert.equal(result.height, "16px");
  assert.notEqual(result.thumbRadius, "0px");
  assert.notEqual(result.thumbBackground, "rgba(0, 0, 0, 0)");
  assert.notEqual(result.trackBackground, "rgba(0, 0, 0, 0)");
}

async function expectFloatingMenusStayInsideViewport(page: Page) {
  await cell(page, 0, 0).evaluate((input) => {
    input.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: window.innerWidth - 4,
        clientY: window.innerHeight - 4
      })
    );
  });
  await expectElementWithinViewport(page, "#cellMenu");
  await page.locator("#cellMenu .context-submenu-trigger").hover();
  await expectElementWithinViewport(page, "#cellMenu .context-submenu-menu");
  await page.keyboard.press("Escape");

  await cell(page, 0, 0).click();
  await page.locator("#autocompleteMenu").waitFor({ state: "visible" });
  await expectElementWithinViewport(page, "#autocompleteMenu");
  await page.keyboard.press("Escape");
}

async function expectElementWithinViewport(page: Page, selector: string) {
  const result = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });

  assert.ok(result.left >= 0);
  assert.ok(result.top >= 0);
  assert.ok(result.right <= result.viewportWidth);
  assert.ok(result.bottom <= result.viewportHeight);
}

async function assertVisibleText(page: Page, text: string) {
  await page.getByText(text).first().waitFor({ state: "visible" });
}

async function autocompleteHasOption(page: Page, text: string) {
  return page.locator("#autocompleteMenu .autocomplete-option", { hasText: text }).count().then((count) => count > 0);
}

async function autocompleteHasExactOption(page: Page, text: string) {
  return page
    .locator("#autocompleteMenu .autocomplete-option")
    .evaluateAll((options, expected) => options.some((option) => option.textContent === expected), text);
}

async function clickEditAction(page: Page, action: string) {
  await page.locator("#cellMenu .context-submenu-trigger").hover();
  await page.locator(`#cellMenu [data-action="${action}"]`).click();
}

async function waitForServer(url: string) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  server.kill();
  throw new Error(`Vite no respondio en ${url}`);
}
