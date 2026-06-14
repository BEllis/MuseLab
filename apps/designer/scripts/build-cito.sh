#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CITO_SRC="$ROOT/third_party/cito"
OUT="$ROOT/tools/cito"

if [ ! -d "$CITO_SRC" ]; then
  echo "Missing third_party/cito. Clone Marco012/cito into third_party/cito first." >&2
  exit 1
fi

if ! command -v dotnet >/dev/null 2>&1; then
  if [ -x "$HOME/.dotnet/dotnet" ]; then
    export DOTNET_ROOT="$HOME/.dotnet"
    export PATH="$DOTNET_ROOT:$PATH"
  else
    echo "dotnet SDK 6+ required. Install from https://dotnet.microsoft.com/download" >&2
    exit 1
  fi
fi

mkdir -p "$OUT"
RID="${CITO_RID:-linux-x64}"
dotnet publish "$CITO_SRC/cito.csproj" -c Release -r "$RID" --self-contained true -o "$OUT" /p:PublishSingleFile=false
echo "Published cito ($RID) -> $OUT/cito.dll"
