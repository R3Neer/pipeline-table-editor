import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = await import("playwright-core");

const port = process.env.SCREENSHOT_PORT || "5174";
const appUrl = `http://127.0.0.1:${port}/`;
const outputDir = new URL("../docs/screenshots/", import.meta.url);
const defaultChromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromePath = process.env.CHROME_PATH || (existsSync(defaultChromePath) ? defaultChromePath : "");

await mkdir(outputDir, { recursive: true });

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
  stdio: "inherit"
});

await waitForServer(appUrl);

const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : { channel: "chrome" }),
  headless: process.env.HEADLESS !== "false"
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });

try {
  await page.goto(appUrl);
  await page.evaluate((state) => {
    localStorage.clear();
    localStorage.setItem("pipeline-table-editor-state-v2", JSON.stringify(state));
    location.reload();
  }, screenshotState());
  await page.waitForSelector(".pipeline-table");
  await page.waitForTimeout(250);

  await page.screenshot({ path: screenshotPath("editor-overview.png"), fullPage: true });

  await page.click("#exportMenuBtn");
  await page.screenshot({ path: screenshotPath("export-menu.png"), fullPage: true });
  await page.keyboard.press("Escape");

  await cell(page, 0, 2).click({ button: "right" });
  await page.locator(".context-submenu-trigger").hover();
  await page.screenshot({ path: screenshotPath("context-menu.png"), fullPage: true });
  await page.keyboard.press("Escape");

  await cell(page, 2, 3).click();
  await page.screenshot({ path: screenshotPath("validation-and-autocomplete.png"), fullPage: true });

  console.log("Screenshots written to app/docs/screenshots");
} finally {
  await browser.close();
  server.kill();
}

function screenshotState() {
  return {
    title: "Forwarding example",
    cycles: 8,
    rows: [
      {
        instruction: "flw f10, 0(x1)",
        cells: [
          { text: "IF", struck: false },
          { text: "ID", struck: false },
          { text: "EX", struck: false },
          { text: "MEM", struck: false },
          { text: "WB", struck: true },
          { text: "", struck: false },
          { text: "", struck: false },
          { text: "", struck: false }
        ]
      },
      {
        instruction: "fmul.s f4, f0, f10",
        cells: [
          { text: "", struck: false },
          { text: "IF", struck: false },
          { text: "IDp", struck: false },
          { text: "ID", struck: false },
          { text: "EX1", struck: false },
          { text: "EX2p", struck: false },
          { text: "EX2", struck: false },
          { text: "MEM", struck: false }
        ]
      },
      {
        instruction: "fadd.s f2, f12, f4",
        cells: [
          { text: "", struck: false },
          { text: "", struck: false },
          { text: "IF", struck: false },
          { text: "MEM", struck: false },
          { text: "EX", struck: false },
          { text: "MEM", struck: false },
          { text: "WB", struck: false },
          { text: "", struck: false }
        ]
      }
    ],
    arrows: [
      { from: { row: 0, cycle: 3 }, to: { row: 1, cycle: 4 }, label: "" },
      { from: { row: 1, cycle: 6 }, to: { row: 2, cycle: 4 }, label: "" }
    ]
  };
}

function cell(page, row, cycle) {
  return page.locator(`.stage-input[data-row="${row}"][data-cycle="${cycle}"]`);
}

function screenshotPath(filename) {
  return fileURLToPath(new URL(filename, outputDir));
}

async function waitForServer(url) {
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
  throw new Error(`Vite did not respond at ${url}`);
}
