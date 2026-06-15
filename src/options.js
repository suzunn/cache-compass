import path from "node:path";
import { cacheRules } from "./catalog.js";
import { parseDuration, parseSize } from "./units.js";

export const helpText = `cache-compass [root] [options]

Find known development cache directories and report how much space they use.
The command is read-only unless --apply is provided.

Options:
  --apply                 Remove the matching cache directories
  --format <text|json>    Select output format (default: text)
  --min-size <size>       Include caches at least this large, for example 10mb
  --older-than <age>      Include caches untouched for this long, for example 7d
  --type <ids>            Limit cache types: node, python, jvm
  --max-depth <number>    Limit directory traversal depth (default: 12)
  --help                  Show help
  --version               Show version
`;

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseOptions(args, cwd = process.cwd()) {
  const options = {
    root: cwd,
    apply: false,
    format: "text",
    minSize: 0,
    olderThan: 0,
    types: new Set(cacheRules.map((rule) => rule.id)),
    maxDepth: 12,
    help: false,
    version: false,
  };
  let positionalRoot;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      options.apply = true;
    } else if (argument === "--help") {
      options.help = true;
    } else if (argument === "--version") {
      options.version = true;
    } else if (argument === "--format") {
      options.format = readValue(args, index, argument);
      index += 1;
    } else if (argument === "--min-size") {
      options.minSize = parseSize(readValue(args, index, argument));
      index += 1;
    } else if (argument === "--older-than") {
      options.olderThan = parseDuration(readValue(args, index, argument));
      index += 1;
    } else if (argument === "--type") {
      const values = readValue(args, index, argument)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      options.types = new Set(values);
      index += 1;
    } else if (argument === "--max-depth") {
      options.maxDepth = Number(readValue(args, index, argument));
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (positionalRoot) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      positionalRoot = argument;
    }
  }

  if (!["text", "json"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }
  if (
    !Number.isInteger(options.maxDepth) ||
    options.maxDepth < 1 ||
    options.maxDepth > 100
  ) {
    throw new Error("--max-depth must be an integer between 1 and 100");
  }

  const knownTypes = new Set(cacheRules.map((rule) => rule.id));
  for (const type of options.types) {
    if (!knownTypes.has(type)) {
      throw new Error(`Unknown cache type: ${type}`);
    }
  }

  options.root = path.resolve(cwd, positionalRoot ?? ".");
  return options;
}
