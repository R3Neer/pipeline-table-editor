import type { Page } from "playwright-core";
import { runArrowsExportImportAndPersistenceScenario } from "./arrowsExportImportAndPersistenceScenario";
import { runExpansionAndCellEditingScenario } from "./expansionAndCellEditingScenario";
import { runSetupLayoutAndRowsScenario } from "./setupLayoutAndRowsScenario";
import { runStageValidationAndAutocompleteScenario } from "./stageValidationAndAutocompleteScenario";

export async function runEditorSmokeScenario(page: Page, appUrl: string) {
  await page.goto(appUrl);
  await page.waitForSelector(".pipeline-table");
  await page.evaluate(() => {
    localStorage.clear();
    location.reload();
  });
  await page.waitForSelector(".pipeline-table");

  await runSetupLayoutAndRowsScenario(page);
  await runStageValidationAndAutocompleteScenario(page);
  await runExpansionAndCellEditingScenario(page);
  await runArrowsExportImportAndPersistenceScenario(page);
}

