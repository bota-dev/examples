#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
project=ios/BotaConnect.xcodeproj
xcodebuild -resolvePackageDependencies -project "$project" -scheme BotaConnect -onlyUsePackageVersionsFromResolvedFile
for destination in 'generic/platform=iOS Simulator' 'generic/platform=iOS'; do
  xcodebuild -project "$project" -scheme BotaConnect -configuration Debug \
    -destination "$destination" -derivedDataPath .build/ios \
    -disableAutomaticPackageResolution -onlyUsePackageVersionsFromResolvedFile \
    CODE_SIGNING_ALLOWED=NO build
done
