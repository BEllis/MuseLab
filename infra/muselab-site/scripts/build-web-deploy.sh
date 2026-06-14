#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SITE_ROOT/../.." && pwd)"
DESIGNER="$REPO_ROOT/apps/designer"
WEB="$REPO_ROOT/web/muselab"

cd "$DESIGNER"
pnpm run build:web-deploy

rm -rf "$SITE_ROOT/dist-deploy"
mkdir -p "$SITE_ROOT/dist-deploy/designer"

cp "$WEB/index.html" "$SITE_ROOT/dist-deploy/index.html"
cp -R "$WEB/assets" "$SITE_ROOT/dist-deploy/assets"
cp -R "$DESIGNER/dist/." "$SITE_ROOT/dist-deploy/designer/"
