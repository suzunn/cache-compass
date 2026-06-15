import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { removeCaches } from "../src/cleaner.js";
import { filterCaches } from "../src/filter.js";
import { scanCaches } from "../src/scanner.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cache-compass-"));
  const paths = {
    node: path.join(root, "app", "node_modules", ".cache"),
    python: path.join(root, "service", ".pytest_cache"),
    ordinary: path.join(root, "assets", ".cache"),
  };
  await mkdir(paths.node, { recursive: true });
  await mkdir(paths.python, { recursive: true });
  await mkdir(paths.ordinary, { recursive: true });
  await writeFile(path.join(paths.node, "bundle.bin"), Buffer.alloc(2048));
  await writeFile(path.join(paths.python, "state"), Buffer.alloc(32));
  await writeFile(path.join(paths.ordinary, "keep.txt"), "keep");
  return { root, paths };
}

test("discovers known caches and ignores generic cache directories", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await scanCaches(root);
  assert.deepEqual(
    result.caches.map((cache) => cache.type).sort(),
    ["node", "python"],
  );
  assert.equal(result.caches[0].bytes, 2048);
  assert.equal(result.warnings.length, 0);
});

test("filters cache entries by type, size, and newest content age", async (t) => {
  const { root, paths } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = new Date(Date.now() - 10 * 24 * 60 * 60_000);
  await utimes(path.join(paths.node, "bundle.bin"), old, old);
  await utimes(paths.node, old, old);

  const result = await scanCaches(root);
  const filtered = filterCaches(
    result.caches,
    {
      minSize: 1024,
      olderThan: 7 * 24 * 60 * 60_000,
      types: new Set(["node"]),
    },
    Date.now(),
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].type, "node");
});

test("removes only rescanned known cache directories", async (t) => {
  const { root, paths } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await scanCaches(root);

  const removals = await removeCaches(root, result.caches);
  assert.ok(removals.every((removal) => removal.status === "removed"));

  const after = await scanCaches(root);
  assert.equal(after.caches.length, 0);
  assert.equal(
    await writeFile(path.join(paths.ordinary, "still-here"), "yes").then(
      () => true,
    ),
    true,
  );
});

test("refuses paths that do not match the cache catalog", async (t) => {
  const { root, paths } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const [result] = await removeCaches(root, [
    {
      path: paths.ordinary,
      relativePath: path.relative(root, paths.ordinary),
      type: "node",
      bytes: 4,
      files: 1,
      modifiedAtMs: Date.now(),
    },
  ]);

  assert.equal(result.status, "failed");
  assert.match(result.error, /no longer matches a known cache rule/);
});
