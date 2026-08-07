#!/usr/bin/env bash
# Builds a zip containing exactly what "Load unpacked" needs - manifest.json,
# icons/, and dist/ - for people installing without cloning the repo (see
# INSTALL.md). Source maps are left out since they point at .ts paths that
# don't exist in the zip and aren't needed to run the extension.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

VERSION=$(node -p "require('./package.json').version")
OUT_DIR="release"
OUT_FILE="${OUT_DIR}/usage-monitor-v${VERSION}.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

zip -rq "$OUT_FILE" manifest.json dist icons -x '*.map'

echo "Packaged: $OUT_FILE"
