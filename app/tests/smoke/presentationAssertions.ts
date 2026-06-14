import assert from "node:assert/strict";
import type { Page } from "playwright-core";
import { cell } from "./editorDriver";

export async function expectInstructionButtonsHaveBreathingRoom(page: Page) {
  const result = await page.evaluate(() => {
    const editor = document.querySelector(".instruction-cell .assembly-editor");
    const firstButton = document.querySelector(".instruction-cell .row-btn");
    if (!(editor instanceof HTMLElement) || !(firstButton instanceof HTMLElement)) return null;
    return firstButton.getBoundingClientRect().left - editor.getBoundingClientRect().right;
  });

  assert.ok(result !== null);
  assert.ok(result >= 14);
}

export async function expectInstructionButtonsDoNotOverlap(page: Page) {
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

export async function expectCustomTextareaResizeHandle(page: Page) {
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

export async function expectAssemblyOverlayUsesInputMetrics(page: Page) {
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

export async function expectCustomScrollbarTheme(page: Page) {
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

export async function expectFloatingMenusStayInsideViewport(page: Page) {
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

