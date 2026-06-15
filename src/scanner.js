import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { findCacheRule } from "./catalog.js";

const traversalSkips = new Set([".git"]);

async function measureDirectory(directory, warnings) {
  const rootStats = await lstat(directory);
  const measurement = {
    bytes: 0,
    files: 0,
    modifiedAtMs: rootStats.mtimeMs,
  };

  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      warnings.push(`${current}: ${error.message}`);
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      let stats;
      try {
        stats = await lstat(entryPath);
      } catch (error) {
        warnings.push(`${entryPath}: ${error.message}`);
        continue;
      }

      measurement.modifiedAtMs = Math.max(
        measurement.modifiedAtMs,
        stats.mtimeMs,
      );
      if (stats.isSymbolicLink()) {
        continue;
      }
      if (stats.isDirectory()) {
        await walk(entryPath);
      } else if (stats.isFile()) {
        measurement.bytes += stats.size;
        measurement.files += 1;
      }
    }
  }

  await walk(directory);
  return measurement;
}

/**
 * Walk a repository tree and return directories that match the cache catalog.
 *
 * The scanner skips symbolic links, avoids `.git`, records read failures as
 * warnings, and measures each matched cache before returning it.
 *
 * @param {string} root Directory to scan.
 * @param {{ maxDepth?: number }} [options] Traversal options.
 * @returns {Promise<{ root: string, caches: Array<object>, warnings: string[] }>}
 */
export async function scanCaches(root, { maxDepth = 12 } = {}) {
  const resolvedRoot = path.resolve(root);
  const rootStats = await lstat(resolvedRoot);
  if (!rootStats.isDirectory()) {
    throw new Error(`Root is not a directory: ${resolvedRoot}`);
  }

  const caches = [];
  const warnings = [];

  async function walk(current, depth) {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      warnings.push(`${current}: ${error.message}`);
      return;
    }

    for (const entry of entries) {
      if (traversalSkips.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(current, entry.name);
      let stats;
      try {
        stats = await lstat(entryPath);
      } catch (error) {
        warnings.push(`${entryPath}: ${error.message}`);
        continue;
      }
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        continue;
      }

      const relativePath = path.relative(resolvedRoot, entryPath);
      const rule = findCacheRule(relativePath);
      if (rule) {
        const measurement = await measureDirectory(entryPath, warnings);
        caches.push({
          path: entryPath,
          relativePath,
          type: rule.id,
          label: rule.label,
          ...measurement,
        });
        continue;
      }

      await walk(entryPath, depth + 1);
    }
  }

  await walk(resolvedRoot, 1);
  caches.sort((left, right) => right.bytes - left.bytes);
  return { root: resolvedRoot, caches, warnings };
}
