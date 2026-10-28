#!/usr/bin/env bash
set -euo pipefail

# Public, anonymous diagnostics only. No credentials, environment dumps, mirror
# fallbacks or dependency retries. The frozen Gradle build remains the gate.
readonly OUT=app/build/reports/ci/repositories
mkdir -p "$OUT"
curl --version | head -n 1
probes=(
  'kotlin-stdlib|https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-stdlib/2.0.21/kotlin-stdlib-2.0.21.pom'
  'kotlin-plugin-bom|https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-gradle-plugins-bom/2.1.20/kotlin-gradle-plugins-bom-2.1.20.pom'
  'asm|https://repo.maven.apache.org/maven2/org/ow2/asm/asm/9.8/asm-9.8.pom'
  'google-agp|https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/8.13.2/gradle-8.13.2.pom'
)
for probe in "${probes[@]}"; do
  name="${probe%%\|*}"; url="${probe#*\|}"
  for agent in curl gradle; do
    user_agent=()
    if [[ "$agent" == gradle ]]; then user_agent=(--user-agent 'Gradle/8.13'); fi
    for method in GET HEAD; do
      key="$name-$agent-$method"
      options=()
      if [[ "$method" == HEAD ]]; then options=(--head); fi
      # Preserve error bodies and response headers for distinguishing a missing
      # artifact from an edge/proxy/network response. Every URL is public.
      if status=$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
        "${options[@]}" "${user_agent[@]}" --dump-header "$OUT/$key.headers" \
        --output "$OUT/$key.body" --write-out '%{http_code}' "$url" 2>"$OUT/$key.stderr"); then
        printf '%s %s %s HTTP %s\n' "$method" "$agent" "$url" "$status" | tee -a "$OUT/summary.txt"
      else
        code=$?
        printf '%s %s %s curl-exit=%s HTTP=%s\n' "$method" "$agent" "$url" "$code" "$status" | tee -a "$OUT/summary.txt"
      fi
      if [[ "$method" == GET && -f "$OUT/$key.body" ]]; then sha256sum "$OUT/$key.body" | tee -a "$OUT/summary.txt"; fi
    done
  done
done
