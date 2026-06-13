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
  assert.equal(await page.locator(".asm-token-instruction").first().textContent(), "flw");
  assert.deepEqual(
    await page.locator("tbody tr:first-child .asm-token-register").evaluateAll((items) => items.map((item) => item.textContent)),
    ["f10", "x1"]
  );

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
  await expectClass(page, 2, 3, "stage-mem");
  await fillCell(page, 2, 1, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");

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
  assert.equal(await cell(page, 1, 5).inputValue(), "EX");
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
  await expectClass(page, 1, 5, "stage-invalid");
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
  page.once("dialog", (dialog) => dialog.accept());
  await cell(page, 0, 2).click();
  assert.equal(await cell(page, 0, 0).inputValue(), "EX1");
  assert.equal(await cell(page, 0, 1).inputValue(), "EX2");
  assert.equal(await cell(page, 0, 2).inputValue(), "EX3");

  await fillCell(page, 0, 3, "MEM2");
  await cell(page, 0, 3).click({ button: "right" });
  await page.locator('#cellMenu [data-action="expand"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await cell(page, 0, 5).click();
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
  await expectClass(page, 2, 4, "stage-invalid");

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
  await cell(page, 1, 4).click();
  assert.equal(await page.locator("#arrowLayer path.arrow-path").count(), 1);
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
  await page.click("#closeExportBtn");

  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="markdown"]').click();
  const markdown = await page.inputValue("#exportOutput");
  assert.match(markdown, /~~WB~~/);
  assert.match(markdown, /Forwarding/);
  await page.click("#closeExportBtn");

  await page.click("#exportMenuBtn");
  await page.locator('#exportMenu [data-export-format="text"]').click();
  const text = await page.inputValue("#exportOutput");
  assert.match(text, /Forwarding:/);
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

async function expectClass(page: Page, row: number, cycle: number, className: string) {
  await page.waitForFunction(
    ({ row, cycle, className }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      return input && input.classList.contains(className);
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
  await page.locator(".context-submenu-trigger").hover();
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
