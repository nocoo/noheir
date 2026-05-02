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

run_bg tests npm run test:coverage
run_bg lint ./node_modules/.bin/eslint --cache --cache-location node_modules/.cache/eslint/ --max-warnings=0

if [ "${SKIP_SECURITY:-0}" != "1" ]; then
  if command -v osv-scanner >/dev/null 2>&1; then
    run_bg osv osv-scanner --lockfile=bun.lock
  else
    echo "\033[1;33m⚠  osv-scanner not installed — vulnerability scan SKIPPED\033[0m"
  fi

  if command -v gitleaks >/dev/null 2>&1; then
    run_bg gitleaks gitleaks protect --staged --no-banner
  else
    echo "\033[1;33m⚠  gitleaks not installed — secret scan SKIPPED\033[0m"
  fi
fi

if [ "${SKIP_E2E:-0}" != "1" ]; then
  if curl -sf http://localhost:8787/api/live >/dev/null 2>&1; then
    run_bg e2e bun run test:e2e
  else
    echo "\033[1;33m⚠  Worker not running — E2E tests SKIPPED (run 'bun run worker:dev' to enable)\033[0m"
  fi
fi

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
