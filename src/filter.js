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
