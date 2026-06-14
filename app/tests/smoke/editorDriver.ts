import type { Page } from "playwright-core";

export async function fillCell(page: Page, row: number, cycle: number, value: string) {
  const locator = cell(page, row, cycle);
  await locator.fill(value);
}

export function cell(page: Page, row: number, cycle: number) {
  return page.locator(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
}

export function instructionRow(page: Page, row: number) {
  return page.locator(`.instruction-table tbody tr:nth-child(${row + 1}) .instruction-cell`);
}

export async function clickRowEditAction(page: Page, action: string) {
  await page.locator("#rowMenu .context-submenu-trigger").hover();
  await page.locator(`#rowMenu [data-row-action="${action}"]`).click();
}

export async function clickEditAction(page: Page, action: string) {
  await page.locator("#cellMenu .context-submenu-trigger").hover();
  await page.locator(`#cellMenu [data-action="${action}"]`).click();
}

export async function assertVisibleText(page: Page, text: string) {
  await page.getByText(text).first().waitFor({ state: "visible" });
}

export async function autocompleteHasOption(page: Page, text: string) {
  return page.locator("#autocompleteMenu .autocomplete-option", { hasText: text }).count().then((count) => count > 0);
}

export async function autocompleteHasExactOption(page: Page, text: string) {
  return page
    .locator("#autocompleteMenu .autocomplete-option")
    .evaluateAll((options, expected) => options.some((option) => option.textContent === expected), text);
}

