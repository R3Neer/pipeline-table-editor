import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const INSPECTED_EXTENSIONS = new Set([".ts"]);
const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?[^'"]+\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
];

type Layer = "app" | "core" | "export" | "integration" | "main" | "ui";

const allowedImports: Record<Layer, Set<Layer>> = {
  app: new Set(["app", "core", "export", "integration", "ui"]),
  core: new Set(["core"]),
  export: new Set(["core", "export"]),
  integration: new Set(["core", "integration"]),
  main: new Set(["app", "core", "export", "integration", "main", "ui"]),
  ui: new Set(["core", "ui"])
};

interface LayerViolation {
  from: string;
  fromLayer: Layer;
  to: string;
  toLayer: Layer;
}

const files = await collectFiles(SRC_ROOT);
const fileSet = new Set(files);
const violations: LayerViolation[] = [];

for (const file of files) {
  const fromLayer = getLayer(file);
  if (!fromLayer) continue;

  for (const dependency of await readRelativeDependencies(file, fileSet)) {
    const toLayer = getLayer(dependency);
    if (!toLayer) continue;
    if (!allowedImports[fromLayer].has(toLayer)) {
      violations.push({
        from: formatPath(file),
        fromLayer,
        to: formatPath(dependency),
        toLayer
      });
    }
  }
}

if (!violations.length) {
  console.log("No layer boundary violations found.");
  process.exit(0);
}

console.error("Layer boundary violations found:\n");
for (const violation of violations) {
  console.error(`- ${violation.from} (${violation.fromLayer}) imports ${violation.to} (${violation.toLayer})`);
}
process.exit(1);

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && INSPECTED_EXTENSIONS.has(extname(entry.name))) {
      files.push(normalizePath(absolutePath));
    }
  }

  return files.sort();
}

async function readRelativeDependencies(file: string, fileSet: Set<string>): Promise<string[]> {
  const text = await readFile(file, "utf8");
  const dependencies = new Set<string>();

  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const specifier = match[1];
      if (specifier.startsWith(".")) {
        const resolved = resolveImport(file, specifier, fileSet);
        if (resolved) dependencies.add(resolved);
      }
      match = pattern.exec(text);
    }
  }

  return [...dependencies].sort();
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | null {
  const base = normalizePath(resolve(dirname(fromFile), specifier));
  const candidates = extname(base) ? [base] : [`${base}.ts`, normalizePath(join(base, "index.ts"))];
  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

function getLayer(file: string): Layer | null {
  const relativePath = normalizePath(relative(SRC_ROOT, file));
  const [topLevel] = relativePath.split("/");
  if (topLevel === "main.ts") return "main";
  if (isLayer(topLevel)) return topLevel;
  return null;
}

function isLayer(value: string): value is Layer {
  return value === "app" || value === "core" || value === "export" || value === "integration" || value === "ui";
}

function formatPath(path: string): string {
  return normalizePath(relative(ROOT, path));
}

function normalizePath(path: string): string {
  return normalize(path).replace(/\\/g, "/");
}
