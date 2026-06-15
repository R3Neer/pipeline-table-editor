import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const appRoot = process.cwd();
const repoRoot = join(appRoot, "..");
const packageJsonPath = join(appRoot, "package.json");
const readmePath = join(repoRoot, "README.md");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: string };
if (!packageJson.version) {
  throw new Error("app/package.json does not define a version.");
}

const readme = await readFile(readmePath, "utf8");
const versionLinePattern = /Current GitHub-ready version: `v[^`]+`\./;
const nextLine = `Current GitHub-ready version: \`v${packageJson.version}\`.`;

if (!versionLinePattern.test(readme)) {
  throw new Error("README version line was not found.");
}

await writeFile(readmePath, readme.replace(versionLinePattern, nextLine), "utf8");
console.log(`Synced README release version to v${packageJson.version}.`);
