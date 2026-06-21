import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
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

test("refuses removal targets outside the scan root", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const [result] = await removeCaches(root, [
    {
      path: root,
      relativePath: ".",
      type: "node",
      bytes: 0,
      files: 0,
      modifiedAtMs: Date.now(),
    },
  ]);

  assert.equal(result.status, "failed");
  assert.match(result.error, /Refusing unsafe cache path/);
});

test("refuses stale scan results when the cache type changes", async (t) => {
  const { root, paths } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const [result] = await removeCaches(root, [
    {
      path: paths.node,
      relativePath: path.relative(root, paths.node),
      type: "python",
      bytes: 2048,
      files: 1,
      modifiedAtMs: Date.now(),
    },
  ]);

  assert.equal(result.status, "failed");
  assert.match(result.error, /Cache type changed before removal/);
});

test("honors traversal depth limits", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const shallow = await scanCaches(root, { maxDepth: 1 });
  const medium = await scanCaches(root, { maxDepth: 2 });
  const deep = await scanCaches(root, { maxDepth: 3 });

  assert.deepEqual(shallow.caches, []);
  assert.deepEqual(
    medium.caches.map((cache) => cache.type),
    ["python"],
  );
  assert.deepEqual(
    deep.caches.map((cache) => cache.type).sort(),
    ["node", "python"],
  );
});

test("measures nested files and sorts caches by descending size", async (t) => {
  const { root, paths } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const nested = path.join(paths.python, "nested");
  await mkdir(nested);
  await writeFile(path.join(nested, "data.bin"), Buffer.alloc(4096));

  const result = await scanCaches(root);

  assert.equal(result.caches[0].type, "python");
  assert.equal(result.caches[0].bytes, 4096 + 32);
  assert.equal(result.caches[0].files, 2);
});

test("ignores directory links and refuses to remove linked caches", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const external = await mkdtemp(path.join(os.tmpdir(), "cache-compass-link-"));
  t.after(() => rm(external, { recursive: true, force: true }));
  const linkedCache = path.join(root, ".turbo");
  await symlink(external, linkedCache, "junction");

  const scan = await scanCaches(root);
  const [removal] = await removeCaches(root, [
    {
      path: linkedCache,
      relativePath: ".turbo",
      type: "node",
      bytes: 0,
      files: 0,
      modifiedAtMs: Date.now(),
    },
  ]);

  assert.equal(
    scan.caches.some((cache) => cache.path === linkedCache),
    false,
  );
  assert.equal(removal.status, "failed");
  assert.match(removal.error, /no longer a real directory/);
});

test("rejects a scan root that is not a directory", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cache-compass-root-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "input.txt");
  await writeFile(file, "not a directory");

  await assert.rejects(() => scanCaches(file), /Root is not a directory/);
});
