import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const roots = ["src", "scripts", "test"];
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(entryPath);
    }
  }
}

for (const root of roots) {
  await collect(root);
}

for (const file of files) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Syntax check failed for ${file}`));
      }
    });
  });
}

console.log(`Checked ${files.length} JavaScript files.`);
