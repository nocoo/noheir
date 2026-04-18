#!/bin/sh
# Run pre-commit checks in parallel: tests, lint, typecheck.
# Aborts on first failure; prints output of failing job.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$(mktemp -d -t precommit.XXXXXX)"
trap 'rm -rf "$LOGDIR"' EXIT

run_bg() {
  local name="$1"; shift
  ( "$@" >"$LOGDIR/$name.log" 2>&1; echo $? >"$LOGDIR/$name.rc" ) &
  eval "${name}_PID=$!"
}

cd "$ROOT"

run_bg tests bun run scripts/check-coverage.ts
run_bg lint ./node_modules/.bin/eslint --cache --cache-location node_modules/.cache/eslint/ --max-warnings=0
run_bg typecheck ./node_modules/.bin/tsc --build

FAIL=0
for name in tests lint typecheck; do
  pid_var="${name}_PID"
  eval "pid=\$$pid_var"
  wait "$pid"
done

for name in tests lint typecheck; do
  rc=$(cat "$LOGDIR/$name.rc" 2>/dev/null || echo 1)
  if [ "$rc" != "0" ]; then
    echo "❌ $name failed (rc=$rc)"
    cat "$LOGDIR/$name.log"
    FAIL=1
  fi
done

exit "$FAIL"
