#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build:cito-wasm
vite build --mode web-deploy

rm -rf dist-deploy
mkdir -p dist-deploy/app

cp web/index.html dist-deploy/index.html
cp -R web/assets dist-deploy/assets
cp -R dist/. dist-deploy/app/
