# Autoresearch: Pre-commit / Pre-push hook performance

## Goal
Reduce wall-clock time for pre-commit and pre-push git hooks while preserving correctness:
- pre-commit: `bun run test:coverage && bunx lint-staged && bun run typecheck`
- pre-push: `bun run test:coverage && bun run lint` (+ optional osv-scanner / gitleaks / e2e)

## Primary metric
`total_s` — sum of pre-commit + pre-push wall time on a representative scenario, measured by `scripts/bench-hooks.sh`.

## Rules
- Do NOT weaken correctness: tests must still actually run, eslint must still report errors, typecheck must still see same project, coverage threshold (90%) must still be enforced (or replaced with equivalent).
- Do NOT skip suites silently. If parallelizing/caching, the same set of work must still happen.
- Don't cheat by removing scripts or shortening their semantics. Fewer redundant invocations (e.g. running coverage twice across pre-commit and pre-push when pre-commit already ran) is OK if equivalent guarantees hold.
- Lint-staged runs eslint on staged files only — keep it scoped that way.
- Track secondary metrics: `precommit_s`, `prepush_s`, `tests_s`, `typecheck_s`, `lint_s`.
- Use atomic commits per accepted change. Do NOT push.
