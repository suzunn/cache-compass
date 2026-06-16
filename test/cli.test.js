import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../src/cli.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cache-compass-cli-"));
  const cache = path.join(root, "web", "node_modules", ".cache");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, "bundle.bin"), Buffer.alloc(128));
  return { root, cache };
}

function createIo() {
  const stdout = [];
  const stderr = [];
  return {
    io: {
      log(message) {
        stdout.push(message);
      },
      error(message) {
        stderr.push(message);
      },
    },
    stdout,
    stderr,
  };
}

test("run renders dry-run JSON reports for matching caches", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { io, stdout, stderr } = createIo();

  const exitCode = await run([root, "--format", "json"], io);
  const report = JSON.parse(stdout[0]);

  assert.equal(exitCode, 0);
  assert.equal(stderr.length, 0);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.summary.directories, 1);
  assert.equal(report.summary.bytes, 128);
  assert.deepEqual(report.caches.map((cache) => cache.path), [
    path.join("web", "node_modules", ".cache"),
  ]);
  assert.deepEqual(report.removals, []);
});

test("run removes matched caches when apply is enabled", async (t) => {
  const { root } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const { io, stdout, stderr } = createIo();

  const exitCode = await run([root, "--apply", "--format", "json"], io);
  const report = JSON.parse(stdout[0]);

  assert.equal(exitCode, 0);
  assert.equal(stderr.length, 0);
  assert.deepEqual(report.removals, [
    {
      path: path.join("web", "node_modules", ".cache"),
      status: "removed",
    },
  ]);

  const after = await run([root, "--format", "json"], createIo().io);
  assert.equal(after, 0);
});

test("run returns usage errors without scanning", async () => {
  const { io, stdout, stderr } = createIo();

  const exitCode = await run(["--format", "xml"], io);

  assert.equal(exitCode, 2);
  assert.equal(stdout.length, 0);
  assert.match(stderr[0], /Unsupported format: xml/);
  assert.match(stderr[1], /--help/);
});
