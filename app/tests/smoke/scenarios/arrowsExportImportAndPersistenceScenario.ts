import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { expectClass, expectNoClass } from "../cellAssertions";
import { cell, fillCell } from "../editorDriver";
import { expectArrowHoverUsesArrowColor } from "../layoutAssertions";

export async function runArrowsExportImportAndPersistenceScenario(page: Page) {
  await expectArrowWorkflow(page);
  await expectExportImportAndPersistence(page);
}

async function expectArrowWorkflow(page: Page) {
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
}

async function expectExportImportAndPersistence(page: Page) {
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
  await fillCell(page, 2, 0, "EXp1");
}

