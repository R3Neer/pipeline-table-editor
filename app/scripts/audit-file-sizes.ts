import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

interface FileReport {
  path: string;
  lines: number;
  level: "review" | "warn" | "fail";
}

const ROOT = process.cwd();
const REVIEW_LIMIT = 100;
const WARNING_LIMIT = 300;
const FAILURE_LIMIT = 500;
const INCLUDED_ROOTS = new Set(["src", "tests", "scripts"]);
const INCLUDED_EXTENSIONS = new Set([".css", ".html", ".js", ".ts"]);
const IGNORED_DIRECTORIES = new Set([".git", "dist", "node_modules"]);
const IGNORED_FILES = new Set(["package-lock.json"]);

const extensionPattern = /\.[^.]+$/;

const reports = (await collectReports(ROOT)).sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
const relevantReports = reports.filter((report) => report.lines > REVIEW_LIMIT);

if (!relevantReports.length) {
  console.log(`No files over ${REVIEW_LIMIT} lines.`);
  process.exit(0);
}

console.log(`Files over ${REVIEW_LIMIT} lines:\n`);
for (const report of relevantReports) {
  const marker = report.level.toUpperCase().padEnd(6);
  console.log(`${marker} ${String(report.lines).padStart(5)} ${report.path}`);
}

const failures = relevantReports.filter((report) => report.level === "fail");
if (failures.length) {
  console.error(`\n${failures.length} file(s) exceed the ${FAILURE_LIMIT}-line limit.`);
  process.exit(1);
}

const warnings = relevantReports.filter((report) => report.level === "warn");
if (warnings.length) {
  console.warn(`\n${warnings.length} file(s) exceed the ${WARNING_LIMIT}-line warning threshold.`);
}

async function collectReports(directory: string): Promise<FileReport[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const reports: FileReport[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) reports.push(...await collectReports(absolutePath));
      continue;
    }

    if (!entry.isFile() || IGNORED_FILES.has(entry.name) || !shouldInspect(absolutePath, entry.name)) continue;

    const text = await readFile(absolutePath, "utf8");
    const lines = countLines(text);
    reports.push({
      path: normalizePath(relative(ROOT, absolutePath)),
      lines,
      level: getLevel(lines)
    });
  }

  return reports;
}

function shouldInspect(absolutePath: string, fileName: string): boolean {
  const [rootDirectory] = normalizePath(relative(ROOT, absolutePath)).split("/");
  if (!INCLUDED_ROOTS.has(rootDirectory)) return false;

  const match = fileName.match(extensionPattern);
  return Boolean(match && INCLUDED_EXTENSIONS.has(match[0]));
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function getLevel(lines: number): FileReport["level"] {
  if (lines > FAILURE_LIMIT) return "fail";
  if (lines > WARNING_LIMIT) return "warn";
  return "review";
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
