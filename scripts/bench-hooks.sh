#!/usr/bin/env bash
# Benchmark pre-commit and pre-push hooks (without actually committing/pushing).
# Simulates a realistic edit by staging a tiny change to a typed source file.
#
# Outputs METRIC lines for autoresearch.

set -u
cd "$(dirname "$0")/.."

ts() { python3 -c 'import time;print(f"{time.time():.4f}")'; }

# Stage a trivial whitespace edit so lint-staged has something to chew on.
STAGE_FILE="src/lib/utils.ts"
ORIG_CONTENT=""
restore() {
  if [ -n "$ORIG_CONTENT" ]; then
    printf '%s' "$ORIG_CONTENT" > "$STAGE_FILE"
  fi
  git reset -q HEAD "$STAGE_FILE" 2>/dev/null || true
}
trap restore EXIT

if [ -f "$STAGE_FILE" ]; then
  ORIG_CONTENT="$(cat "$STAGE_FILE")"
  printf '\n' >> "$STAGE_FILE"
  git add "$STAGE_FILE"
fi

run_phase() {
  local name="$1"; shift
  local start end
  start="$(ts)"
  "$@" >/tmp/bench-hooks-$$.log 2>&1
  local rc=$?
  end="$(ts)"
  local dur
  dur="$(python3 -c "print(f'{$end-$start:.3f}')")"
  if [ $rc -ne 0 ]; then
    echo "PHASE FAIL: $name rc=$rc" >&2
    tail -40 /tmp/bench-hooks-$$.log >&2
    rm -f /tmp/bench-hooks-$$.log
    echo "METRIC ${name}_s=$dur"
    return $rc
  fi
  rm -f /tmp/bench-hooks-$$.log
  echo "METRIC ${name}_s=$dur"
  printf '%s' "$dur" >&2
}

# ---- pre-commit phases ----
PC_START="$(ts)"
TESTS_S="$(run_phase tests bun run test:coverage)" || exit 1
LS_S="$(run_phase lintstaged bunx lint-staged)" || exit 1
TC_S="$(run_phase typecheck bun run typecheck)" || exit 1
PC_END="$(ts)"
PRECOMMIT_S="$(python3 -c "print(f'{$PC_END-$PC_START:.3f}')")"
echo "METRIC precommit_s=$PRECOMMIT_S"

# ---- pre-push phases ----
PP_START="$(ts)"
TESTS2_S="$(run_phase tests2 bun run test:coverage)" || exit 1
LINT_S="$(run_phase lint bun run lint)" || exit 1
PP_END="$(ts)"
PREPUSH_S="$(python3 -c "print(f'{$PP_END-$PP_START:.3f}')")"
echo "METRIC prepush_s=$PREPUSH_S"

TOTAL="$(python3 -c "print(f'{$PRECOMMIT_S+$PREPUSH_S:.3f}')")"
echo "METRIC total_s=$TOTAL"
