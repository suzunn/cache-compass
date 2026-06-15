import { lstat, rm } from "node:fs/promises";
import path from "node:path";
import { findCacheRule } from "./catalog.js";

function assertSafeTarget(root, candidate) {
  const relativePath = path.relative(root, candidate);
  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === ".." ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing unsafe cache path: ${candidate}`);
  }

  const rule = findCacheRule(relativePath);
  if (!rule) {
    throw new Error(`Path no longer matches a known cache rule: ${candidate}`);
  }
  return rule;
}

/**
 * Remove cache directories that still match the catalog under the scan root.
 *
 * Each target is resolved again before deletion so stale scan results cannot
 * remove paths outside the root or paths that no longer look like known caches.
 *
 * @param {string} root Original scan root.
 * @param {Array<object>} caches Cache entries returned by the scanner/filter.
 * @returns {Promise<Array<object>>} Removal results with `removed` or `failed` status.
 */
export async function removeCaches(root, caches) {
  const resolvedRoot = path.resolve(root);
  const results = [];

  for (const cache of caches) {
    const candidate = path.resolve(cache.path);
    try {
      const rule = assertSafeTarget(resolvedRoot, candidate);
      if (rule.id !== cache.type) {
        throw new Error(`Cache type changed before removal: ${candidate}`);
      }

      const stats = await lstat(candidate);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error(`Cache is no longer a real directory: ${candidate}`);
      }

      await rm(candidate, { recursive: true, force: false });
      results.push({ ...cache, status: "removed" });
    } catch (error) {
      results.push({ ...cache, status: "failed", error: error.message });
    }
  }

  return results;
}
