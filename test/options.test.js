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

test("parses help and version flags without changing the default root", () => {
  const helpOptions = parseOptions(["--help"], "/workspace");
  const versionOptions = parseOptions(["--version"], "/workspace");

  assert.equal(helpOptions.root, path.resolve("/workspace"));
  assert.equal(helpOptions.help, true);
  assert.equal(helpOptions.version, false);
  assert.equal(versionOptions.root, path.resolve("/workspace"));
  assert.equal(versionOptions.help, false);
  assert.equal(versionOptions.version, true);
});

test("rejects options with missing values", () => {
  assert.throws(() => parseOptions(["--format"]), /--format requires a value/);
  assert.throws(
    () => parseOptions(["--min-size", "--apply"]),
    /--min-size requires a value/,
  );
});

test("rejects invalid output formats and extra positional arguments", () => {
  assert.throws(() => parseOptions(["--format", "xml"]), /Unsupported format/);
  assert.throws(() => parseOptions(["--verbose"]), /Unknown option: --verbose/);
  assert.throws(
    () => parseOptions(["workspace", "other"]),
    /Unexpected argument: other/,
  );
});
