#!/usr/bin/env bash
set -euo pipefail

NEW_VERSION="${1:?Usage: bump-version.sh <version>}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$ ]]; then
  echo "Invalid semver: $NEW_VERSION (expected e.g. 0.2.0)" >&2
  exit 1
fi

OLD_VERSION="$(node -p "require('./package.json').version")"

echo "Package: ${OLD_VERSION} -> ${NEW_VERSION}"

npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version

echo "Version bump complete."
