# Cache Compass

Cache Compass is a dependency-free Node.js CLI for finding stale development
caches in mixed-language repositories. It reports disk usage before changing
anything and only removes directories that still match a conservative cache
catalog at deletion time.

It recognizes tool-specific cache paths instead of broad names such as
`build`, `dist`, or a generic `.cache` directory. The initial catalog covers:

- Node.js tooling: `node_modules/.cache`, `node_modules/.vite`, `.next/cache`,
  `.yarn/cache`, `.nx/cache`, `.turbo`, and `.parcel-cache`
- Python tooling: `__pycache__`, `.pytest_cache`, `.mypy_cache`, and
  `.ruff_cache`
- JVM tooling: `.gradle/caches`

## Requirements

- Node.js 20 or newer

## Install

Run without installing:

```sh
npx cache-compass .
```

Or install globally:

```sh
npm install --global cache-compass
```

## Usage

Scan the current repository:

```sh
cache-compass .
```

Only show Node.js and Python caches that are at least 10 MB and whose newest
content is seven days old:

```sh
cache-compass . --type node,python --min-size 10mb --older-than 7d
```

Produce machine-readable output:

```sh
cache-compass . --format json
```

Remove the directories from the filtered report:

```sh
cache-compass . --older-than 30d --apply
```

The default mode is always a dry run. Cache Compass does not follow symbolic
links, does not traverse `.git`, and revalidates every removal target against
the catalog and scan root immediately before deletion.

## Options

| Option | Description |
| --- | --- |
| `--apply` | Remove matched cache directories |
| `--format <text\|json>` | Select report format |
| `--min-size <size>` | Filter by bytes, KB, MB, or GB |
| `--older-than <age>` | Filter by minutes, hours, days, or weeks |
| `--type <ids>` | Filter by `node`, `python`, or `jvm` |
| `--max-depth <number>` | Limit traversal depth, default `12` |
| `--help` | Show CLI help |
| `--version` | Show the package version |

## Development

```sh
npm install
npm run ci
```

The test suite covers option parsing, units, cache discovery, filtering,
conservative path checks, and actual cleanup in temporary directories.

## License

MIT
