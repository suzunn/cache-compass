#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { removeCaches } from "./cleaner.js";
import { filterCaches } from "./filter.js";
import { helpText, parseOptions } from "./options.js";
import { formatJsonReport, formatTextReport } from "./report.js";
import { scanCaches } from "./scanner.js";

async function readVersion() {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.join(currentDirectory, "..", "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  return packageJson.version;
}

/**
 * Execute the CLI command and return a process-style exit code.
 *
 * @param {string[]} args Raw command-line arguments without the executable name.
 * @param {{ log: Function, error: Function }} [io] Output adapter for tests.
 * @returns {Promise<number>} Exit code.
 */
export async function run(args, io = console) {
  let options;
  try {
    options = parseOptions(args);
  } catch (error) {
    io.error(`cache-compass: ${error.message}`);
    io.error("Run cache-compass --help for usage.");
    return 2;
  }

  if (options.help) {
    io.log(helpText.trimEnd());
    return 0;
  }
  if (options.version) {
    io.log(await readVersion());
    return 0;
  }

  try {
    const scan = await scanCaches(options.root, {
      maxDepth: options.maxDepth,
    });
    const caches = filterCaches(scan.caches, options);
    const removalResults = options.apply
      ? await removeCaches(scan.root, caches)
      : [];
    const reportInput = {
      root: scan.root,
      caches,
      warnings: scan.warnings,
      apply: options.apply,
      removalResults,
    };
    io.log(
      options.format === "json"
        ? formatJsonReport(reportInput)
        : formatTextReport(reportInput),
    );

    return removalResults.some((result) => result.status === "failed") ? 1 : 0;
  } catch (error) {
    io.error(`cache-compass: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2));
}
