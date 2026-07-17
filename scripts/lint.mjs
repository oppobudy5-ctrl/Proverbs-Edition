import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["config", "data", "js", "scripts", "src"];
const files = [];

for (const directory of SOURCE_DIRS) {
  await collect(path.join(ROOT, directory));
}

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    failures.push(`${path.relative(ROOT, file)}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`VALID: ${files.length} file JavaScript lolos syntax lint.`);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      files.push(fullPath);
    }
  }
}
