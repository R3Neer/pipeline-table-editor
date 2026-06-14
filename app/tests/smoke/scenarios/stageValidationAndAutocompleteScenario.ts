import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { expectClass, expectNoClass } from "../cellAssertions";
import { assertVisibleText, autocompleteHasExactOption, autocompleteHasOption, cell, fillCell } from "../editorDriver";

export async function runStageValidationAndAutocompleteScenario(page: Page) {
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

  await expectNumberedPendingAutocomplete(page);
  await expectVerticalPendingValidation(page);
  await expectStageOrderAndPreviousStageValidation(page);
  await expectContextualAutocomplete(page);
}

async function expectNumberedPendingAutocomplete(page: Page) {
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
  await resetFirstRows(page);
}

async function expectVerticalPendingValidation(page: Page) {
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
}

async function expectStageOrderAndPreviousStageValidation(page: Page) {
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
}

async function expectContextualAutocomplete(page: Page) {
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
}

async function resetFirstRows(page: Page) {
  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 1, 0, "");
  await fillCell(page, 1, 1, "IF");
  await fillCell(page, 1, 2, "IDp");
  await fillCell(page, 1, 3, "ID");
  await fillCell(page, 1, 4, "EX1");
}

