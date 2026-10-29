#!/usr/bin/env bash
# Builds youfloww-newtab-<version>.zip (the file you upload to the Chrome Web Store).
set -euo pipefail
cd "$(dirname "$0")"
V=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/youfloww-newtab-$V.zip"
mkdir -p dist && rm -f "$OUT"
zip -qr "$OUT" manifest.json newtab.html newtab.css newtab.js theme.js icons img -x "*.DS_Store"
echo "Built extension/$OUT ($(du -h "$OUT" | cut -f1))"
