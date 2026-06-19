import test from "node:test";
import assert from "node:assert/strict";
import {
  createSummary,
  formatJsonReport,
  formatTextReport,
} from "../src/report.js";

const now = Date.UTC(2026, 0, 15, 12);

function cache(overrides = {}) {
  return {
    relativePath: "app/node_modules/.cache",
    type: "node",
    bytes: 2048,
    files: 3,
    modifiedAtMs: now - 2 * 24 * 60 * 60_000,
    ...overrides,
  };
}

test("creates aggregate summaries for report results", () => {
  assert.deepEqual(createSummary([cache(), cache({ bytes: 512, files: 1 })]), {
    directories: 2,
    files: 4,
    bytes: 2560,
  });
});

test("formats dry-run text reports with cache rows and warnings", () => {
  const output = formatTextReport({
    root: "/workspace",
    caches: [cache()],
    warnings: ["/workspace/locked: EACCES"],
    apply: false,
    now,
  });

  assert.match(output, /Root: \/workspace/);
  assert.match(output, /Matched 1 cache directories, 3 files, 2.00 KB\./);
  assert.match(output, /TYPE\s+SIZE\s+AGE\s+FILES\s+PATH/);
  assert.match(output, /node\s+2.00 KB\s+2d\s+3\s+app\/node_modules\/\.cache/);
  assert.match(output, /Dry run only\. Add --apply to remove/);
  assert.match(output, /Warnings: 1/);
  assert.match(output, /- \/workspace\/locked: EACCES/);
});

test("formats apply reports with reclaimed bytes and failed removals", () => {
  const output = formatTextReport({
    root: "/workspace",
    caches: [cache(), cache({ relativePath: "service/.pytest_cache" })],
    warnings: [],
    apply: true,
    removalResults: [
      { ...cache(), status: "removed" },
      {
        ...cache({ relativePath: "service/.pytest_cache", bytes: 4096 }),
        status: "failed",
        error: "permission denied",
      },
    ],
    now,
  });

  assert.match(output, /Removed 1 cache directories and reclaimed 2.00 KB\./);
  assert.match(output, /Failed: service\/\.pytest_cache: permission denied/);
  assert.doesNotMatch(output, /Dry run only/);
});

test("formats stable JSON reports for scripts", () => {
  const output = formatJsonReport({
    root: "/workspace",
    caches: [cache()],
    warnings: ["scan warning"],
    apply: true,
    removalResults: [
      { ...cache(), status: "removed" },
      {
        ...cache({ relativePath: "service/.pytest_cache" }),
        status: "failed",
        error: "permission denied",
      },
    ],
  });

  assert.deepEqual(JSON.parse(output), {
    root: "/workspace",
    mode: "apply",
    summary: {
      directories: 1,
      files: 3,
      bytes: 2048,
    },
    caches: [
      {
        path: "app/node_modules/.cache",
        type: "node",
        bytes: 2048,
        files: 3,
        modifiedAt: new Date(now - 2 * 24 * 60 * 60_000).toISOString(),
      },
    ],
    removals: [
      {
        path: "app/node_modules/.cache",
        status: "removed",
      },
      {
        path: "service/.pytest_cache",
        status: "failed",
        error: "permission denied",
      },
    ],
    warnings: ["scan warning"],
  });
});
