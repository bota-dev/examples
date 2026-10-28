#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
swift build -c release
binary_dir="$(swift build -c release --show-bin-path)"
mkdir -p BotaRecordings.app/Contents/MacOS
cp "$binary_dir/BotaRecordings" BotaRecordings.app/Contents/MacOS/
cp Info.plist BotaRecordings.app/Contents/Info.plist
codesign --force --sign - BotaRecordings.app
printf '%s\n' 'Built BotaRecordings.app. Run: open BotaRecordings.app'
