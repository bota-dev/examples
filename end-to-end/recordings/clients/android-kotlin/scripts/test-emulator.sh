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
# A failed/timed-out probe is not proof that the serial is free. Refuse unknown
# state rather than risk cleaning up an emulator that this script did not start.
if probe="$(timeout --signal=TERM --kill-after=5s 10 "$ADB" -s "$SERIAL" get-state 2>&1)"; then
  printf '%s is already present; refusing to use it\n' "$SERIAL" >&2
  exit 1
else
  grep -Fq "device '$SERIAL' not found" <<<"$probe" || { printf 'Cannot establish that %s is free\n' "$SERIAL" >&2; exit 1; }
fi
emulator_pid=""
logcat_pid=""
phase() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a app/build/reports/runtime/phases.txt; }
stop_owned_process() {
  local pid="$1" label="$2"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    timeout 10 tail --pid="$pid" -f /dev/null >/dev/null 2>&1 || true
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
    timeout 5 tail --pid="$pid" -f /dev/null >/dev/null 2>&1 || true
  fi
  if kill -0 "$pid" 2>/dev/null; then
    phase "$label did not exit within the shutdown budget"
    return 1
  else
    wait "$pid" 2>/dev/null || true # Only reap after the owned process has exited.
  fi
}
cleanup() {
  local result=$? cleanup_failed=0
  trap - EXIT HUP INT TERM
  set +e
  if [[ -n "$emulator_pid" ]]; then
    phase 'preserving isolated emulator logs'
    # Preserve uncaught reactor/linkage crashes before the isolated emulator is
    # destroyed. Test reports alone cannot describe a process-level Android crash.
    timeout --signal=TERM --kill-after=5s 15 "$ADB" -s "$SERIAL" logcat -b crash -d -v threadtime \
      >app/build/reports/runtime/logcat-crash.txt 2>&1 || true
    timeout --signal=TERM --kill-after=5s 15 "$ADB" -s "$SERIAL" logcat -b all -d -v threadtime \
      >app/build/reports/runtime/logcat-final.txt 2>&1 || true
    if [[ -n "$logcat_pid" ]]; then
      stop_owned_process "$logcat_pid" logcat || cleanup_failed=1
      logcat_pid=""
    fi
    timeout --signal=TERM --kill-after=5s 10 "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1 || true
    stop_owned_process "$emulator_pid" emulator || cleanup_failed=1
    emulator_pid=""
  fi
  timeout --signal=TERM --kill-after=5s 30 "$AVDMANAGER" delete avd --name "$NAME" >/dev/null 2>&1 || true
  if (( result == 0 && cleanup_failed != 0 )); then result=1; fi
  phase "cleanup finished; final status=$result"
  exit "$result" # EXIT-trap function returns alone do not replace a successful script status.
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
phase 'creating dedicated API29 emulator'
printf 'no\n' | timeout --signal=TERM --kill-after=15s 120 "$AVDMANAGER" create avd --force --name "$NAME" --package 'system-images;android-29;google_apis;x86_64'
"$EMULATOR" -avd "$NAME" -port 5580 -no-window -no-audio -no-boot-anim \
  -no-snapshot -wipe-data -gpu swiftshader_indirect -cores 2 -memory 2048 \
  >app/build/reports/runtime/emulator.log 2>&1 &
emulator_pid=$!
phase "waiting for $SERIAL boot"
booted=false
boot_deadline=$((SECONDS + 360))
while (( SECONDS < boot_deadline )); do
  if [[ "$(timeout --signal=TERM --kill-after=2s 5 "$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]]; then booted=true; break; fi
  kill -0 "$emulator_pid" 2>/dev/null || { cat app/build/reports/runtime/emulator.log; exit 1; }
  sleep 2
done
[[ "$booted" == true ]]
timeout --signal=TERM --kill-after=5s 10 "$ADB" -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r' | grep -qx 29
phase 'API29 boot verified; starting isolated log capture'
"$ADB" -s "$SERIAL" logcat -b all -v threadtime \
  >app/build/reports/runtime/logcat-live.txt 2>&1 &
logcat_pid=$!
phase 'installing application APK (120-second budget)'
timeout --signal=TERM --kill-after=15s 120 "$ADB" -s "$SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk \
  2>&1 | tee app/build/reports/runtime/install-app.txt
phase 'installing instrumentation APK (120-second budget)'
timeout --signal=TERM --kill-after=15s 120 "$ADB" -s "$SERIAL" install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk \
  2>&1 | tee app/build/reports/runtime/install-test.txt
for package in dev.bota.examples.recordings.kotlin dev.bota.examples.recordings.kotlin.test; do
  phase "verifying installed debug package $package"
  timeout --signal=TERM --kill-after=5s 15 "$ADB" -s "$SERIAL" shell pm path "$package" \
    | tee "app/build/reports/runtime/$package-path.txt" | grep -q '^package:'
  timeout --signal=TERM --kill-after=5s 15 "$ADB" -s "$SERIAL" shell dumpsys package "$package" \
    >"app/build/reports/runtime/$package-info.txt"
  grep -qE '(flags|pkgFlags)=\[.*DEBUGGABLE' "app/build/reports/runtime/$package-info.txt"
done
timeout --signal=TERM --kill-after=5s 15 "$ADB" -s "$SERIAL" shell pm list instrumentation \
  | tee app/build/reports/runtime/installed-instrumentation.txt \
  | grep -Fq 'dev.bota.examples.recordings.kotlin.test/dev.bota.examples.recordings.TransportInstrumentation (target=dev.bota.examples.recordings.kotlin)'
phase 'starting five transport cases (300-second shell budget)'
# -r preserves the machine-readable final code even when Instrumentation returns a stream.
timeout --signal=TERM --kill-after=15s 300 "$ADB" -s "$SERIAL" shell am instrument -w -r \
  dev.bota.examples.recordings.kotlin.test/dev.bota.examples.recordings.TransportInstrumentation \
  | tee app/build/reports/runtime/instrumentation.txt
grep -q 'OK (5 tests)' app/build/reports/runtime/instrumentation.txt
grep -q 'INSTRUMENTATION_CODE: -1' app/build/reports/runtime/instrumentation.txt
! grep -q 'INSTRUMENTATION_FAILED\|INSTRUMENTATION_STATUS_CODE: -2' app/build/reports/runtime/instrumentation.txt
phase 'five cases and raw final success code verified'
