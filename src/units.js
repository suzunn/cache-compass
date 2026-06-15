const sizeUnits = new Map([
  ["b", 1],
  ["kb", 1024],
  ["kib", 1024],
  ["mb", 1024 ** 2],
  ["mib", 1024 ** 2],
  ["gb", 1024 ** 3],
  ["gib", 1024 ** 3],
]);

const durationUnits = new Map([
  ["m", 60_000],
  ["h", 60 * 60_000],
  ["d", 24 * 60 * 60_000],
  ["w", 7 * 24 * 60 * 60_000],
]);

function parseUnitValue(input, units, label) {
  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(input);
  if (!match) {
    throw new Error(`Invalid ${label}: ${input}`);
  }

  const multiplier = units.get(match[2].toLowerCase());
  if (!multiplier) {
    throw new Error(`Unsupported ${label} unit: ${match[2]}`);
  }

  return Number(match[1]) * multiplier;
}

/**
 * Parse a size string such as `10mb` into bytes.
 *
 * @param {string} input Size value with a supported unit suffix.
 * @returns {number} Rounded byte count.
 */
export function parseSize(input) {
  return Math.round(parseUnitValue(input, sizeUnits, "size"));
}

/**
 * Parse a duration string such as `7d` into milliseconds.
 *
 * @param {string} input Duration value with a supported unit suffix.
 * @returns {number} Rounded millisecond count.
 */
export function parseDuration(input) {
  return Math.round(parseUnitValue(input, durationUnits, "duration"));
}

/**
 * Format a byte count for terminal reports.
 *
 * @param {number} bytes Byte count.
 * @returns {string} Human-readable size.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = "B";
  for (const candidate of units) {
    value /= 1024;
    unit = candidate;
    if (value < 1024) {
      break;
    }
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

/**
 * Format elapsed time since a cache entry was last modified.
 *
 * @param {number} modifiedAtMs Last modified timestamp in milliseconds.
 * @param {number} [now] Current timestamp for deterministic tests.
 * @returns {string} Compact age string.
 */
export function formatAge(modifiedAtMs, now = Date.now()) {
  const elapsed = Math.max(0, now - modifiedAtMs);
  const hours = Math.floor(elapsed / (60 * 60_000));
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 14) {
    return `${days}d`;
  }

  return `${Math.floor(days / 7)}w`;
}
