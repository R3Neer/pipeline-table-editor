import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright-core";

export interface SmokeApp {
  appUrl: string;
  browser: Browser;
  page: Page;
  server: ChildProcess;
  close(): Promise<void>;
}

const defaultChromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";

export async function startSmokeApp(): Promise<SmokeApp> {
  const port = process.env.SMOKE_PORT || "5175";
  const appUrl = `http://127.0.0.1:${port}/`;
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"],
    { stdio: "inherit" }
  );

  await waitForServer(appUrl, server);

  const browser = await chromium.launch({
    ...getChromeLaunchOptions(),
    headless: process.env.HEADLESS !== "false"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  return {
    appUrl,
    browser,
    page,
    server,
    async close() {
      await browser.close();
      server.kill();
    }
  };
}

function getChromeLaunchOptions(): { executablePath: string } | { channel: "chrome" } {
  const chromePath =
    process.env.CHROME_PATH || (existsSync(defaultChromePath) ? defaultChromePath : "");
  return chromePath ? { executablePath: chromePath } : { channel: "chrome" };
}

async function waitForServer(url: string, server: ChildProcess) {
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

