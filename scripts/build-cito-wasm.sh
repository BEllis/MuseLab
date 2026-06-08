#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/wasm/cito/cito-wasm.csproj"
OUT="$ROOT/public/cito-wasm"

if [ ! -d "$ROOT/third_party/cito" ]; then
  echo "Missing third_party/cito. Clone Marco012/cito into third_party/cito first." >&2
  exit 1
fi

if ! command -v dotnet >/dev/null 2>&1; then
  if [ -x "$HOME/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="$HOME/.dotnet"
    export PATH="$DOTNET_ROOT:$PATH"
  else
    echo "dotnet SDK 8+ required. Install from https://dotnet.microsoft.com/download" >&2
    exit 1
  fi
fi

if ! dotnet workload list 2>/dev/null | rg -q 'wasm-tools'; then
  echo "Installing dotnet wasm-tools workload..." >&2
  dotnet workload install wasm-tools
fi

BUNDLE="$ROOT/wasm/cito/bin/Release/net8.0/browser-wasm/AppBundle"
dotnet publish "$PROJECT" -c Release

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a "$BUNDLE/." "$OUT/"
echo "Published cito WASM -> $OUT"
