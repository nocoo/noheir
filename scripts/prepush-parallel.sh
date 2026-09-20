#!/bin/sh
# Parallel pre-push: run tests, lint, security scans, and E2E concurrently.
# Each job logs to a temp file; on failure the failing job's output is shown.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$(mktemp -d -t prepush.XXXXXX)"
trap 'rm -rf "$LOGDIR"' EXIT

cd "$ROOT"

JOBS=""

run_bg() {
  local name="$1"; shift
  ( "$@" >"$LOGDIR/$name.log" 2>&1; echo $? >"$LOGDIR/$name.rc" ) &
  JOBS="$JOBS $name:$!"
}

run_bg tests bun run test:coverage
run_bg worker bun run --cwd worker test:coverage
run_bg lint ./node_modules/.bin/biome check --error-on-warnings .

command -v osv-scanner >/dev/null 2>&1 || { echo "osv-scanner is required"; exit 1; }
command -v gitleaks >/dev/null 2>&1 || { echo "gitleaks is required"; exit 1; }
run_bg osv osv-scanner --config=osv-scanner.toml --lockfile=bun.lock --lockfile=worker/bun.lock
run_bg gitleaks gitleaks git --no-banner --redact --log-opts="origin/main..HEAD"
run_bg e2e bun run test:e2e

# Wait for all
for entry in $JOBS; do
  pid="${entry##*:}"
  wait "$pid"
done

FAIL=0
for entry in $JOBS; do
  name="${entry%%:*}"
  rc=$(cat "$LOGDIR/$name.rc" 2>/dev/null || echo 1)
  if [ "$rc" != "0" ]; then
    echo "❌ $name failed (rc=$rc)"
    cat "$LOGDIR/$name.log"
    FAIL=1
  fi
done

exit "$FAIL"
