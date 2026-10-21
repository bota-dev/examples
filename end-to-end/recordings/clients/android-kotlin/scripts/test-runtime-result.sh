#!/usr/bin/env bash
set -euo pipefail

readonly CHECKER="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/check-runtime-result.sh"
fixture="$(mktemp)"
trap 'rm -f -- "$fixture"' EXIT
passed=0
expect() {
  local label="$1" expected="$2" result
  printf '%b' "$3" >"$fixture"
  if bash "$CHECKER" "$fixture" >/dev/null 2>&1; then result=0; else result=$?; fi
  if [[ "$result" != "$expected" ]]; then
    printf '%s: expected status %s, got %s\n' "$label" "$expected" "$result" >&2
    exit 1
  fi
  passed=$((passed + 1))
}

readonly OK='INSTRUMENTATION_RESULT: stream=OK (5 tests)\n'
readonly FINAL='INSTRUMENTATION_CODE: -1\n'
expect valid 0 "INSTRUMENTATION_STATUS_CODE: 0\n$OK$FINAL"
expect valid-crlf 0 'INSTRUMENTATION_STATUS_CODE: 0\r\nINSTRUMENTATION_RESULT: stream=OK (5 tests)\r\nINSTRUMENTATION_CODE: -1\r\n'
expect failure-marker 1 "$OK${FINAL}INSTRUMENTATION_FAILED: synthetic\n"
expect failure-status 1 "$OK${FINAL}INSTRUMENTATION_STATUS_CODE: -2\n"
expect error-status 1 "$OK${FINAL}INSTRUMENTATION_STATUS_CODE: -1\n"
expect missing-final 1 "$OK"
expect wrong-final 1 "${OK}INSTRUMENTATION_CODE: 0\n"
expect final-prefix 1 "${OK}INSTRUMENTATION_CODE: -10\n"
expect duplicate-final 1 "$OK$FINAL$FINAL"
expect conflicting-final 1 "$OK${FINAL}INSTRUMENTATION_CODE: 0\n"
expect malformed-final 1 "${OK}INSTRUMENTATION_CODE: -1 extra\n"
expect missing-case-receipt 1 "$FINAL"
expect wrong-case-count 1 "INSTRUMENTATION_RESULT: stream=OK (4 tests)\n$FINAL"
expect misleading-case-receipt 1 "INSTRUMENTATION_RESULT: stream=NOT OK (5 tests)\n$FINAL"
printf '%s runtime-result fixtures passed\n' "$passed"
