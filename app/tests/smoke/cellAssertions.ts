import assert from "node:assert/strict";
import type { Page } from "playwright-core";

export async function expectClass(page: Page, row: number, cycle: number, className: string) {
  await page.waitForFunction(
    ({ row, cycle, className }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      return input && input.classList.contains(className);
    },
    { row, cycle, className }
  );
}

export async function expectNoClass(page: Page, row: number, cycle: number, className: string) {
  await page.waitForFunction(
    ({ row, cycle, className }) => {
      const input = document.querySelector(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
      return input && !input.classList.contains(className);
    },
    { row, cycle, className }
  );
}

export async function expectOpacity(page: Page, selector: string, expected: string) {
  await page.waitForFunction(
    ({ selector, expected }) => getComputedStyle(document.querySelector(selector)).opacity === expected,
    { selector, expected }
  );
}

export async function expectInstructionValue(page: Page, row: number, expected: string) {
  await page.waitForFunction(
    ({ row, expected }) => {
      const input = document.querySelector(`.assembly-input[data-row="${row}"]`);
      return input instanceof HTMLInputElement && input.value === expected;
    },
    { row, expected }
  );
}

export async function expectInstructionRowSelected(page: Page, row: number) {
  await page.waitForFunction(
    (row) => document.querySelector(`.instruction-cell[data-row="${row}"]`)?.classList.contains("row-selected"),
    row
  );
}

export async function expectRowLabelStyle(page: Page, text: string) {
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

