#!/usr/bin/env bash
set -euo pipefail

if (( $# != 1 )) || [[ ! -f "$1" || ! -r "$1" ]]; then
  printf 'Expected one readable instrumentation result file\n' >&2
  exit 1
fi

# Android raw output uses CRLF on some hosts. Count final records instead of
# matching a substring: -10 and duplicate/conflicting completion codes fail.
if awk '
  { sub(/\r$/, "") }
  $0 == "OK (5 tests)" || $0 == "INSTRUMENTATION_RESULT: stream=OK (5 tests)" { ok++ }
  /^INSTRUMENTATION_CODE:/ { finals++; if ($0 != "INSTRUMENTATION_CODE: -1") bad = 1 }
  /INSTRUMENTATION_FAILED/ || /^INSTRUMENTATION_STATUS_CODE: -/ { bad = 1 }
  END { exit !(ok == 1 && finals == 1 && !bad) }
' "$1"; then
  exit 0
fi
printf 'Instrumentation did not report five successful cases and one exact final success code\n' >&2
exit 1
