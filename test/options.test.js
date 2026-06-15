import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseOptions } from "../src/options.js";

test("parses filters and an explicit root", () => {
  const options = parseOptions(
    [
      "workspace",
      "--min-size",
      "2mb",
      "--older-than",
      "3d",
      "--type",
      "node,python",
      "--max-depth",
      "8",
      "--format",
      "json",
      "--apply",
    ],
    "/tmp",
  );

  assert.equal(options.root, path.resolve("/tmp", "workspace"));
  assert.equal(options.minSize, 2 * 1024 ** 2);
  assert.equal(options.olderThan, 3 * 24 * 60 * 60_000);
  assert.deepEqual([...options.types], ["node", "python"]);
  assert.equal(options.maxDepth, 8);
  assert.equal(options.format, "json");
  assert.equal(options.apply, true);
});

test("rejects unknown cache types and unsafe depth values", () => {
  assert.throws(() => parseOptions(["--type", "unknown"]), /Unknown cache type/);
  assert.throws(() => parseOptions(["--max-depth", "0"]), /between 1 and 100/);
});
