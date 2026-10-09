#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
swift build -c release
binary_dir="$(swift build -c release --show-bin-path)"
mkdir -p BotaCatalog.app/Contents/MacOS
cp "$binary_dir/BotaCatalog" BotaCatalog.app/Contents/MacOS/
cp Info.plist BotaCatalog.app/Contents/Info.plist
codesign --force --sign - BotaCatalog.app
printf '%s\n' 'Built BotaCatalog.app. Run: open BotaCatalog.app'
