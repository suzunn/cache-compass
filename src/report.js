import { formatAge, formatBytes } from "./units.js";

function pad(value, width) {
  return String(value).padEnd(width);
}

export function createSummary(caches) {
  return {
    directories: caches.length,
    files: caches.reduce((total, cache) => total + cache.files, 0),
    bytes: caches.reduce((total, cache) => total + cache.bytes, 0),
  };
}

export function formatTextReport({
  root,
  caches,
  warnings,
  apply,
  removalResults = [],
  now = Date.now(),
}) {
  const summary = createSummary(caches);
  const lines = [
    `Root: ${root}`,
    `Matched ${summary.directories} cache directories, ${summary.files} files, ${formatBytes(summary.bytes)}.`,
  ];

  if (caches.length > 0) {
    const rows = caches.map((cache) => ({
      type: cache.type,
      size: formatBytes(cache.bytes),
      age: formatAge(cache.modifiedAtMs, now),
      files: cache.files,
      path: cache.relativePath,
    }));
    const widths = {
      type: Math.max(4, ...rows.map((row) => row.type.length)),
      size: Math.max(4, ...rows.map((row) => row.size.length)),
      age: Math.max(3, ...rows.map((row) => row.age.length)),
      files: Math.max(5, ...rows.map((row) => String(row.files).length)),
    };

    lines.push("");
    lines.push(
      `${pad("TYPE", widths.type)}  ${pad("SIZE", widths.size)}  ${pad("AGE", widths.age)}  ${pad("FILES", widths.files)}  PATH`,
    );
    for (const row of rows) {
      lines.push(
        `${pad(row.type, widths.type)}  ${pad(row.size, widths.size)}  ${pad(row.age, widths.age)}  ${pad(row.files, widths.files)}  ${row.path}`,
      );
    }
  }

  if (apply) {
    const removed = removalResults.filter(
      (result) => result.status === "removed",
    );
    const failed = removalResults.filter((result) => result.status === "failed");
    lines.push("");
    lines.push(
      `Removed ${removed.length} cache directories and reclaimed ${formatBytes(
        removed.reduce((total, result) => total + result.bytes, 0),
      )}.`,
    );
    for (const result of failed) {
      lines.push(`Failed: ${result.relativePath}: ${result.error}`);
    }
  } else if (caches.length > 0) {
    lines.push("");
    lines.push("Dry run only. Add --apply to remove the matched directories.");
  }

  if (warnings.length > 0) {
    lines.push("");
    lines.push(`Warnings: ${warnings.length}`);
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

export function formatJsonReport({
  root,
  caches,
  warnings,
  apply,
  removalResults = [],
}) {
  return JSON.stringify(
    {
      root,
      mode: apply ? "apply" : "dry-run",
      summary: createSummary(caches),
      caches: caches.map((cache) => ({
        path: cache.relativePath,
        type: cache.type,
        bytes: cache.bytes,
        files: cache.files,
        modifiedAt: new Date(cache.modifiedAtMs).toISOString(),
      })),
      removals: removalResults.map((result) => ({
        path: result.relativePath,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
      })),
      warnings,
    },
    null,
    2,
  );
}
