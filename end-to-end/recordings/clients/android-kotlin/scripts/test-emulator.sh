#!/usr/bin/env bash
set -euo pipefail

# Dedicated emulator only: never target a connected phone or other ADB serial.
readonly SDK="${ANDROID_HOME:?ANDROID_HOME is required}"
readonly ADB="$SDK/platform-tools/adb"
readonly EMULATOR="$SDK/emulator/emulator"
readonly AVDMANAGER="$SDK/cmdline-tools/latest/bin/avdmanager"
readonly SERIAL=emulator-5580
readonly NAME=bota-recordings-api29
export ANDROID_AVD_HOME="${RUNNER_TEMP:?RUNNER_TEMP must be a temporary directory}/recordings-avd-${GITHUB_RUN_ID:-local}"
mkdir -p "$ANDROID_AVD_HOME" app/build/reports/runtime
test -z "$("$ADB" -s "$SERIAL" get-state 2>/dev/null || true)"
emulator_pid=""
logcat_pid=""
cleanup() {
  if [[ -n "$emulator_pid" ]]; then
    # Preserve uncaught reactor/linkage crashes before the isolated emulator is
    # destroyed. Test reports alone cannot describe a process-level Android crash.
    timeout 15 "$ADB" -s "$SERIAL" logcat -b crash -d -v threadtime \
      >app/build/reports/runtime/logcat-crash.txt 2>&1 || true
    timeout 15 "$ADB" -s "$SERIAL" logcat -b all -d -v threadtime \
      >app/build/reports/runtime/logcat-final.txt 2>&1 || true
    if [[ -n "$logcat_pid" ]]; then
      kill "$logcat_pid" 2>/dev/null || true
      wait "$logcat_pid" 2>/dev/null || true
      logcat_pid=""
    fi
    "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1 || true
    wait "$emulator_pid" 2>/dev/null || true
    emulator_pid=""
  fi
  "$AVDMANAGER" delete avd --name "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM
printf 'no\n' | "$AVDMANAGER" create avd --force --name "$NAME" --package 'system-images;android-29;google_apis;x86_64'
"$EMULATOR" -avd "$NAME" -port 5580 -no-window -no-audio -no-boot-anim \
  -no-snapshot -wipe-data -gpu swiftshader_indirect -cores 2 -memory 2048 \
  >app/build/reports/runtime/emulator.log 2>&1 &
emulator_pid=$!
booted=false
for _ in $(seq 1 180); do
  if [[ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]; then booted=true; break; fi
  kill -0 "$emulator_pid" 2>/dev/null || { cat app/build/reports/runtime/emulator.log; exit 1; }
  sleep 2
done
[[ "$booted" == true ]]
"$ADB" -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r' | grep -qx 29
"$ADB" -s "$SERIAL" logcat -b all -v threadtime \
  >app/build/reports/runtime/logcat-live.txt 2>&1 &
logcat_pid=$!
"$ADB" -s "$SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
"$ADB" -s "$SERIAL" install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
timeout --signal=TERM --kill-after=15s 300 "$ADB" -s "$SERIAL" shell am instrument -w \
  dev.bota.examples.recordings.kotlin.test/dev.bota.examples.recordings.TransportInstrumentation \
  | tee app/build/reports/runtime/instrumentation.txt
grep -q 'OK (5 tests)' app/build/reports/runtime/instrumentation.txt
grep -q 'INSTRUMENTATION_CODE: -1' app/build/reports/runtime/instrumentation.txt
! grep -q 'INSTRUMENTATION_FAILED\|INSTRUMENTATION_STATUS_CODE: -2' app/build/reports/runtime/instrumentation.txt
