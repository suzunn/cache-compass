import test from "node:test";
import assert from "node:assert/strict";
import { filterCaches } from "../src/filter.js";

const now = Date.UTC(2026, 5, 20);
const day = 24 * 60 * 60_000;

const caches = [
  { path: "node-small", type: "node", bytes: 100, modifiedAtMs: now - day },
  { path: "node-large", type: "node", bytes: 500, modifiedAtMs: now - 7 * day },
  { path: "python-large", type: "python", bytes: 500, modifiedAtMs: now - 14 * day },
];

test("returns every cache when no filters are active", () => {
  assert.deepEqual(filterCaches(caches, {}, now), caches);
});

test("combines type, size, and age filters", () => {
  const result = filterCaches(
    caches,
    { minSize: 500, olderThan: 7 * day, types: new Set(["node"]) },
    now,
  );

  assert.deepEqual(result.map((cache) => cache.path), ["node-large"]);
});

test("includes entries exactly on size and age boundaries", () => {
  const result = filterCaches(
    caches,
    { minSize: 500, olderThan: 14 * day },
    now,
  );

  assert.deepEqual(result.map((cache) => cache.path), ["python-large"]);
});

test("supports selecting multiple cache types", () => {
  const result = filterCaches(
    caches,
    { types: new Set(["node", "python"]) },
    now,
  );

  assert.deepEqual(result, caches);
});
