#!/usr/bin/env bash
set -euo pipefail

NEW_VERSION="${1:?Usage: bump-version.sh <version>}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
  echo "Invalid semver: $NEW_VERSION (expected e.g. 0.2.0)" >&2
  exit 1
fi

OLD_VERSION="$(node -p "require('./apps/designer/package.json').version")"

echo "Designer: ${OLD_VERSION} -> ${NEW_VERSION}"

node -e "
const fs = require('fs');
const paths = ['package.json', 'apps/designer/package.json'];
for (const file of paths) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.version = process.argv[1];
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
" "$NEW_VERSION"

echo "Version bump complete."
