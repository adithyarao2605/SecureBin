import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_ROOTS = ["app", "lib", "tests", "scripts"];
const ALLOWED = new Set(["scripts/source-audit.mjs"]);
const secretLog = /console\.(?:log|info|warn|error)\s*\([^\n]*(?:request\.(?:url|postData|body)|response\.(?:url|body|text)|(?:discussion|delete|edit)[A-Za-z]*Capability|envelope|editToken)/i;

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const entryPath = join(path, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  }))).flat();
}

const files = (await Promise.all(SCAN_ROOTS.map((path) => walk(join(ROOT, path))))).flat();
const failures = [];
for (const file of files) {
  const local = relative(ROOT, file);
  if (ALLOWED.has(local) || !/\.(?:[cm]?[jt]sx?|py)$/.test(file)) continue;
  if (secretLog.test(await readFile(file, "utf8"))) failures.push(local);
}
if (failures.length) {
  console.error(`Unsafe capability, envelope, or request-body logging: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("OK: source audit found no secret-bearing diagnostics");
