#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for destination in 'generic/platform=iOS Simulator' 'generic/platform=iOS'; do
  xcodebuild -project ios/BotaRecordings.xcodeproj -scheme BotaRecordings -configuration Debug \
    -destination "$destination" -derivedDataPath .build/ios \
    -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
done
