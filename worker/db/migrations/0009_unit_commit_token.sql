-- 003 Unit Commit — per-commit token
-- Spec: docs/003-unit-commit-and-log-enrichment.md § Decision E
--
-- The batch's log INSERTs must only apply when this commit's CAS UPDATE did.
-- Guarding on the row's post-state cannot prove that: two requests making the
-- same edit in the same millisecond produce an identical post-state, so the
-- loser's guard matches the winner's row and writes logs for a commit that
-- returned 409 (reproduced against SQLite: updateChanges=0, logInsert=1).
--
-- A random token written by the UPDATE and matched by the INSERTs is unique to
-- one batch, so it proves authorship rather than resemblance.

ALTER TABLE capital_units ADD COLUMN commit_token TEXT;
