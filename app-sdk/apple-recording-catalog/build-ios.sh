#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
project=ios/BotaCatalog.xcodeproj
xcodebuild -resolvePackageDependencies -project "$project" -scheme BotaCatalog -onlyUsePackageVersionsFromResolvedFile
for destination in 'generic/platform=iOS Simulator' 'generic/platform=iOS'; do
  xcodebuild -project "$project" -scheme BotaCatalog -configuration Debug \
    -destination "$destination" -derivedDataPath .build/ios \
    -disableAutomaticPackageResolution -onlyUsePackageVersionsFromResolvedFile \
    CODE_SIGNING_ALLOWED=NO build
done
