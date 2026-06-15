import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAge,
  formatBytes,
  parseDuration,
  parseSize,
} from "../src/units.js";

test("parses size and duration values", () => {
  assert.equal(parseSize("1.5mb"), 1.5 * 1024 ** 2);
  assert.equal(parseSize("20 KiB"), 20 * 1024);
  assert.equal(parseDuration("2w"), 14 * 24 * 60 * 60_000);
});

test("formats byte counts and cache ages", () => {
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatAge(Date.now() - 8 * 24 * 60 * 60_000), "8d");
});

test("rejects unsupported unit values", () => {
  assert.throws(() => parseSize("10"), /Invalid size/);
  assert.throws(() => parseDuration("3months"), /Unsupported duration unit/);
});
