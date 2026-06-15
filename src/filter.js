/**
 * Apply user-selected type, size, and age constraints to scanned cache entries.
 *
 * @param {Array<object>} caches Cache entries returned by the scanner.
 * @param {{ minSize?: number, olderThan?: number, types?: Set<string> }} options
 * @param {number} [now] Timestamp used for age comparisons.
 * @returns {Array<object>} Cache entries that match all active filters.
 */
export function filterCaches(
  caches,
  { minSize = 0, olderThan = 0, types = new Set() },
  now = Date.now(),
) {
  return caches.filter((cache) => {
    const typeMatches = types.size === 0 || types.has(cache.type);
    const sizeMatches = cache.bytes >= minSize;
    const ageMatches =
      olderThan === 0 || now - cache.modifiedAtMs >= olderThan;
    return typeMatches && sizeMatches && ageMatches;
  });
}
