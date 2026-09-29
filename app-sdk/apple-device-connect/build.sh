#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
swift build -c release
binary_dir="$(swift build -c release --show-bin-path)"
mkdir -p BotaConnect.app/Contents/MacOS
cp "$binary_dir/BotaConnect" BotaConnect.app/Contents/MacOS/
cp Info.plist BotaConnect.app/Contents/Info.plist
codesign --force --sign - BotaConnect.app
printf '%s\n' 'Built BotaConnect.app. Run: open BotaConnect.app'
