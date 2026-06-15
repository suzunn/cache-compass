import path from "node:path";

const suffixRule = (suffix) => {
  const expected = suffix.split("/");
  return (parts) =>
    parts.length >= expected.length &&
    expected.every(
      (part, index) => parts[parts.length - expected.length + index] === part,
    );
};

const basenameRule = (name) => (parts) => parts.at(-1) === name;

export const cacheRules = [
  {
    id: "node",
    label: "Node.js tooling",
    matches: [
      suffixRule("node_modules/.cache"),
      suffixRule("node_modules/.vite"),
      suffixRule(".next/cache"),
      suffixRule(".yarn/cache"),
      suffixRule(".nx/cache"),
      basenameRule(".turbo"),
      basenameRule(".parcel-cache"),
    ],
  },
  {
    id: "python",
    label: "Python tooling",
    matches: [
      basenameRule("__pycache__"),
      basenameRule(".pytest_cache"),
      basenameRule(".mypy_cache"),
      basenameRule(".ruff_cache"),
    ],
  },
  {
    id: "jvm",
    label: "JVM tooling",
    matches: [suffixRule(".gradle/caches")],
  },
];

export function findCacheRule(relativePath) {
  const parts = relativePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((part) => (process.platform === "win32" ? part.toLowerCase() : part));

  return cacheRules.find((rule) =>
    rule.matches.some((matches) => matches(parts)),
  );
}

export function relativeCachePath(root, candidate) {
  return path.relative(path.resolve(root), path.resolve(candidate));
}
