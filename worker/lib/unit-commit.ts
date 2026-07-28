/**
 * Pure statement builder for POST /api/units/:id/commit.
 *
 * Emits a single d1.batch() sequence that is atomic in two senses:
 *   - D1 rolls the whole batch back if any statement errors.
 *   - Optimistic concurrency is expressed as SQL guards, so a stale read makes
 *     every statement match zero rows instead of writing a partial result.
 *
 * Statement [0] carries the full `expected` comparison. Every later statement
 * keys off a POST-state predicate that only holds if [0] applied, so the caller
 * can decide 409 from results[0].meta.changes alone — no compensating writes.
 *
 * See docs/003-unit-commit-and-log-enrichment.md § Decision E.
 */

export interface Statement {
  sql: string;
  params: unknown[];
}

/** Raw capital_units snapshot the client echoes back for CAS. */
export interface ExpectedUnitSnapshot {
  unitCode: string;
  amountCents: number;
  productId: string | null;
  currency: string | null;
  status: string | null;
  strategy: string | null;
  tactics: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
}

export interface CommitMetadata {
  unitCode?: string | undefined;
  amountCents?: number | undefined;
  currency?: string | undefined;
  status?: string | undefined;
  strategy?: string | undefined;
  tactics?: string | undefined;
  startDate?: string | null | undefined;
  unitNote?: string | null | undefined;
}

export type CommitOperation =
  | { kind: "swap_unit_code"; targetUnitId: string }
  | { kind: "switch_product"; toProductId: string | null; pnlCents?: number | null | undefined };

export interface SwapTarget {
  id: string;
  unitCode: string;
  /** The partner's own product, snapshotted onto its adjust log so the row
   *  still joins on /capital-logs. A swap does not move products. */
  productId: string | null;
  productName: string | null;
}

export interface ProductRef {
  id: string;
  name: string | null;
}

export interface BuildCommitInput {
  userId: string;
  unitId: string;
  expected: ExpectedUnitSnapshot;
  metadata?: CommitMetadata | undefined;
  operations: CommitOperation[];
  operationDate: string;
  /** Local "today" for the archive date. Distinct from operationDate, which the
   *  user may backdate when recording a past event — archiving still happens now. */
  today: string;
  commitNote?: string | null | undefined;
  /** Resolved swap partner, required when a swap_unit_code op is present. */
  swapTarget?: SwapTarget | undefined;
  /** Product the unit is currently in, for the withdraw log. */
  fromProduct?: ProductRef | null | undefined;
  /** Product the unit moves into, for the invest log. */
  toProduct?: ProductRef | null | undefined;
  /** Epoch ms stamped onto created_at / updated_at. Need not be unique: the
   *  log guards assert every CAS-guarded column, so a shared millisecond alone
   *  cannot make a losing commit's guard match. */
  now: number;
  /** UUID factory (injected so the builder stays pure and testable). */
  newId: () => string;
}

const ARCHIVED = "已归档";

/**
 * endDate is derived, never client-supplied: archived units get a date,
 * everything else is forced to null. Mirrors PUT /api/units/:id
 * (worker/src/index.ts:901-922) so /commit cannot produce illegal states.
 *
 * status is nullable in the DB (schema.ts:63 uses .default(), not .notNull()),
 * and null falls into the non-archived branch.
 */
export function resolveEndDate(
  finalStatus: string | null,
  originalStatus: string | null,
  originalEndDate: string | null,
  today: string,
): string | null {
  if (finalStatus !== ARCHIVED) return null;
  if (originalStatus !== ARCHIVED) return originalEndDate ?? today;
  return originalEndDate;
}

/** `col = ?` or `col IS NULL` — SQLite has no null-safe equality operator. */
function nullSafeEq(column: string, value: unknown, params: unknown[]): string {
  if (value == null) return `${column} IS NULL`;
  params.push(value);
  return `${column} = ?`;
}

export function describeMetadataChange(
  expected: ExpectedUnitSnapshot,
  metadata: CommitMetadata,
): string[] {
  const parts: string[] = [];
  const push = (label: string, from: unknown, to: unknown) => {
    parts.push(`${label} ${from ?? "∅"}→${to ?? "∅"}`);
  };

  if (metadata.unitCode !== undefined && metadata.unitCode !== expected.unitCode) {
    push("编号", expected.unitCode, metadata.unitCode);
  }
  if (metadata.amountCents !== undefined && metadata.amountCents !== expected.amountCents) {
    push("金额", expected.amountCents / 100, metadata.amountCents / 100);
  }
  if (metadata.currency !== undefined && metadata.currency !== expected.currency) {
    push("币种", expected.currency, metadata.currency);
  }
  if (metadata.status !== undefined && metadata.status !== expected.status) {
    push("状态", expected.status, metadata.status);
  }
  if (metadata.strategy !== undefined && metadata.strategy !== expected.strategy) {
    push("策略", expected.strategy, metadata.strategy);
  }
  if (metadata.tactics !== undefined && metadata.tactics !== expected.tactics) {
    push("战术", expected.tactics, metadata.tactics);
  }
  if (metadata.startDate !== undefined && metadata.startDate !== expected.startDate) {
    push("开始日期", expected.startDate, metadata.startDate);
  }
  if (metadata.unitNote !== undefined && metadata.unitNote !== expected.note) {
    push("备注", expected.note, metadata.unitNote);
  }
  return parts;
}

/** Machine-readable context first, user note appended. */
function composeNote(context: string, commitNote?: string | null): string {
  const trimmed = commitNote?.trim();
  return trimmed ? `${context}\n${trimmed}` : context;
}

export function buildCommitStatements(input: BuildCommitInput): Statement[] {
  const {
    userId,
    unitId,
    expected,
    metadata,
    operations,
    operationDate,
    today,
    commitNote,
    swapTarget,
    fromProduct,
    toProduct,
    now,
    newId,
  } = input;

  const swapOp = operations.find((o) => o.kind === "swap_unit_code");
  const switchOp = operations.find((o) => o.kind === "switch_product");

  const statements: Statement[] = [];

  // ── [0] the unit row + full CAS guard ──
  const sets: string[] = [];
  const setParams: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    setParams.push(value);
  };

  // A swap rewrites this unit's code to the partner's; otherwise metadata may.
  const finalUnitCode = swapOp && swapTarget ? swapTarget.unitCode : metadata?.unitCode;
  if (finalUnitCode !== undefined) set("unit_code", finalUnitCode);
  if (metadata?.amountCents !== undefined) set("amount_cents", metadata.amountCents);
  if (metadata?.currency !== undefined) set("currency", metadata.currency);
  if (metadata?.status !== undefined) set("status", metadata.status);
  if (metadata?.strategy !== undefined) set("strategy", metadata.strategy);
  if (metadata?.tactics !== undefined) set("tactics", metadata.tactics);
  if (metadata?.startDate !== undefined) set("start_date", metadata.startDate);
  if (metadata?.unitNote !== undefined) set("note", metadata.unitNote);
  // Same row as the metadata edit, so it rides the same CAS. Kept out of a
  // separate statement: that one could only re-check product_id + unit_code,
  // neither of which changes when [0] fails on some other field — the switch
  // would then apply while the endpoint reported 409.
  if (switchOp) set("product_id", switchOp.toProductId);

  // Always written: non-archived units must have end_date = NULL.
  const finalStatus = metadata?.status ?? expected.status;
  set("end_date", resolveEndDate(finalStatus, expected.status, expected.endDate, today));
  set("updated_at", now);

  const whereParams: unknown[] = [];
  const where: string[] = [];
  whereParams.push(unitId, userId);
  where.push("id = ?", "user_id = ?");
  whereParams.push(expected.unitCode, expected.amountCents);
  where.push("unit_code = ?", "amount_cents = ?");
  where.push(nullSafeEq("product_id", expected.productId, whereParams));
  where.push(nullSafeEq("currency", expected.currency, whereParams));
  where.push(nullSafeEq("status", expected.status, whereParams));
  where.push(nullSafeEq("strategy", expected.strategy, whereParams));
  where.push(nullSafeEq("tactics", expected.tactics, whereParams));
  where.push(nullSafeEq("start_date", expected.startDate, whereParams));
  where.push(nullSafeEq("end_date", expected.endDate, whereParams));
  where.push(nullSafeEq("note", expected.note, whereParams));

  if (swapOp && swapTarget) {
    // The partner's product is snapshotted onto its log, so it must also be
    // guarded: without this, a concurrent switch between the endpoint's read
    // and the batch would log the partner against a product it already left.
    const targetGuard: string[] = ["id = ?", "user_id = ?", "unit_code = ?"];
    whereParams.push(swapTarget.id, userId, swapTarget.unitCode);
    targetGuard.push(nullSafeEq("product_id", swapTarget.productId, whereParams));
    where.push(`EXISTS (SELECT 1 FROM capital_units WHERE ${targetGuard.join(" AND ")})`);
  }

  statements.push({
    sql: `UPDATE capital_units SET ${sets.join(", ")} WHERE ${where.join(" AND ")}`,
    params: [...setParams, ...whereParams],
  });

  // ── [1] the swap partner, guarded on [0]'s post-state ──
  if (swapOp && swapTarget) {
    statements.push({
      sql: `UPDATE capital_units SET unit_code = ?, updated_at = ?
            WHERE id = ? AND user_id = ? AND unit_code = ?
              AND EXISTS (SELECT 1 FROM capital_units WHERE id = ? AND user_id = ? AND unit_code = ?)`,
      params: [
        expected.unitCode,
        now,
        swapTarget.id,
        userId,
        swapTarget.unitCode,
        unitId,
        userId,
        swapTarget.unitCode,
      ],
    });
  }

  // ── [3..n] logs, each guarded on the unit reaching its post-state ──
  const unitStatementCount = statements.length;
  // Logs may only exist if [0] applied. Rather than trusting a timestamp to be
  // unique per batch (two commits can share a millisecond), the guard asserts
  // the row now holds every value [0] would have written — the post-state of
  // this specific commit. A losing CAS leaves at least one field at its old
  // value, so the EXISTS fails and the INSERTs match zero rows.
  //
  // Every CAS-guarded column is asserted, not just the ones this commit wrote:
  // a note-only commit sets almost nothing, so a guard built from the SET list
  // alone would ignore amount_cents and could match a row another request had
  // just changed (given a shared updated_at millisecond).
  const written = new Map<string, unknown>();
  for (const [i, fragment] of sets.entries()) {
    written.set(fragment.slice(0, fragment.indexOf(" ")), setParams[i]);
  }

  const postStateCols: string[] = ["id = ?", "user_id = ?"];
  const postStateParams: unknown[] = [unitId, userId];
  const assertPostState = (column: string, priorValue: unknown) => {
    // Columns this commit wrote must equal the new value; the rest must still
    // equal what the client saw. `col = NULL` is never true in SQL, so nulls
    // go through IS NULL.
    const value = written.has(column) ? written.get(column) : priorValue;
    postStateCols.push(nullSafeEq(column, value, postStateParams));
  };

  assertPostState("unit_code", expected.unitCode);
  assertPostState("amount_cents", expected.amountCents);
  assertPostState("product_id", expected.productId);
  assertPostState("currency", expected.currency);
  assertPostState("status", expected.status);
  assertPostState("strategy", expected.strategy);
  assertPostState("tactics", expected.tactics);
  assertPostState("start_date", expected.startDate);
  assertPostState("end_date", expected.endDate);
  assertPostState("note", expected.note);
  assertPostState("updated_at", now);

  const logGuardSql = `EXISTS (SELECT 1 FROM capital_units WHERE ${postStateCols.join(" AND ")})`;
  const pushLog = (log: {
    unitId: string;
    productId: string | null;
    productName: string | null;
    operationType: string;
    amountCents: number;
    pnlCents: number | null;
    note: string;
  }) => {
    statements.push({
      sql: `INSERT INTO contribution_logs
              (id, user_id, unit_id, product_id, product_name, operation_type,
               amount_cents, pnl_cents, operation_date, source, note, created_at, updated_at)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE ${logGuardSql}`,
      params: [
        newId(),
        userId,
        log.unitId,
        log.productId,
        log.productName,
        log.operationType,
        log.amountCents,
        log.pnlCents,
        operationDate,
        "auto",
        log.note,
        now,
        now,
        ...postStateParams,
      ],
    });
  };

  if (swapOp && swapTarget) {
    const context = `番号对换: ${expected.unitCode} ⇄ ${swapTarget.unitCode}`;
    pushLog({
      unitId,
      productId: expected.productId,
      productName: fromProduct?.name ?? null,
      operationType: "adjust",
      amountCents: 0,
      pnlCents: null,
      note: composeNote(context, commitNote),
    });
    pushLog({
      unitId: swapTarget.id,
      productId: swapTarget.productId,
      productName: swapTarget.productName,
      operationType: "adjust",
      amountCents: 0,
      pnlCents: null,
      note: composeNote(context, commitNote),
    });
  }

  if (switchOp) {
    const amount = metadata?.amountCents ?? expected.amountCents;
    if (expected.productId) {
      pushLog({
        unitId,
        productId: expected.productId,
        productName: fromProduct?.name ?? null,
        operationType: "withdraw",
        amountCents: -amount,
        pnlCents: switchOp.pnlCents ?? null,
        note: composeNote(`切换产品: 退出 ${fromProduct?.name ?? "未知产品"}`, commitNote),
      });
    }
    if (switchOp.toProductId) {
      pushLog({
        unitId,
        productId: switchOp.toProductId,
        productName: toProduct?.name ?? null,
        operationType: "invest",
        amountCents: amount,
        pnlCents: null,
        note: composeNote(`切换产品: 投入 ${toProduct?.name ?? "未知产品"}`, commitNote),
      });
    }
  }

  // Metadata-only edits still leave a trace (docs/003 § D4/D6).
  const metadataParts = metadata ? describeMetadataChange(expected, metadata) : [];
  if (metadataParts.length > 0) {
    pushLog({
      unitId,
      productId: expected.productId,
      productName: fromProduct?.name ?? null,
      operationType: "adjust",
      amountCents: 0,
      pnlCents: null,
      note: composeNote(`元数据修改: ${metadataParts.join(", ")}`, commitNote),
    });
  }

  // Note-only commit: the note IS the log entry (docs/003 § 待确认 1).
  const logCount = statements.length - unitStatementCount;
  if (logCount === 0 && commitNote?.trim()) {
    pushLog({
      unitId,
      productId: expected.productId,
      productName: fromProduct?.name ?? null,
      operationType: "adjust",
      amountCents: 0,
      pnlCents: null,
      note: commitNote.trim(),
    });
  }

  return statements;
}
