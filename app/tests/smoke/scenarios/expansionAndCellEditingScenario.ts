import assert from "node:assert/strict";
import type { Dialog, Page } from "playwright-core";
import { expectClass, expectNoClass } from "../cellAssertions";
import { cell, clickEditAction, fillCell } from "../editorDriver";

export async function runExpansionAndCellEditingScenario(page: Page) {
  await expectExpansionWorkflow(page);
  await resetRowsForCellEditing(page);
  await expectCellContextMenuEditing(page);
  await expectMultiCellSelection(page);
}

async function expectExpansionWorkflow(page: Page) {
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

  await resetRowsAfterExpansion(page);
  await expectExpansionWithoutDialogs(page);
}

async function expectExpansionWithoutDialogs(page: Page) {
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
}

async function expectCellContextMenuEditing(page: Page) {
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
}

async function expectMultiCellSelection(page: Page) {
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
}

async function resetRowsAfterExpansion(page: Page) {
  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 0, 3, "MEM");
  await fillCell(page, 0, 4, "WB");
  await fillCell(page, 0, 5, "");
  await fillCell(page, 2, 2, "");
  await fillCell(page, 2, 3, "");
  await fillCell(page, 2, 4, "");
}

async function resetRowsForCellEditing(page: Page) {
  await fillCell(page, 0, 0, "IF");
  await fillCell(page, 0, 1, "ID");
  await fillCell(page, 0, 2, "EX");
  await fillCell(page, 0, 3, "MEM");
  await fillCell(page, 0, 4, "WB");
  await fillCell(page, 0, 5, "");
}

