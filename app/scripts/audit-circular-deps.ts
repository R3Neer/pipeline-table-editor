import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const INSPECTED_EXTENSIONS = new Set([".ts", ".css"]);
const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?[^'"]+\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+["']([^"']+)["']/g
];

const files = await collectFiles(SRC_ROOT);
const fileSet = new Set(files);
const graph = new Map<string, string[]>();

for (const file of files) {
  graph.set(file, await readRelativeDependencies(file, fileSet));
}

const cycles = findCycles(graph);

if (!cycles.length) {
  console.log("No circular dependencies found.");
  process.exit(0);
}

console.error("Circular dependencies found:\n");
for (const cycle of cycles) {
  console.error(`- ${cycle.map(formatPath).join(" -> ")}`);
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
  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.css`, normalizePath(join(base, "index.ts"))];
  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles = new Map<string, string[]>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  for (const node of graph.keys()) {
    visit(node);
  }

  return [...cycles.values()].sort((a, b) => formatPath(a[0]).localeCompare(formatPath(b[0])));

  function visit(node: string): void {
    if (visiting.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      cycles.set(canonicalCycleKey(cycle), cycle);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) || []) {
      visit(dependency);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
}

function canonicalCycleKey(cycle: string[]): string {
  const nodes = cycle.slice(0, -1);
  const rotations = nodes.map((_, index) => nodes.slice(index).concat(nodes.slice(0, index)));
  const canonical = rotations
    .map((rotation) => rotation.map(formatPath).join(" -> "))
    .sort()[0];
  return canonical;
}

function formatPath(path: string): string {
  return normalizePath(relative(ROOT, path));
}

function normalizePath(path: string): string {
  return normalize(path).replace(/\\/g, "/");
}
