/**
 * Pure planning logic for the unit editor's staged-commit flow.
 *
 * The editor holds `useState<StagedOperation[]>` and a form snapshot; every
 * decision about what that means is made here so it stays unit-testable.
 * Replaces src/lib/unit-update-diff.ts, whose two-payload split existed only to
 * work around the worker's "productId must be updated alone" rule — product
 * changes now travel as an operation instead.
 *
 * See docs/003-unit-commit-and-log-enrichment.md § UI.
 */

import type { ExpectedUnitSnapshot, SerializedUnit } from "@/domain/types";

export type StagedOperation =
  | { kind: "swap_unit_code"; targetUnitId: string; targetUnitCode: string }
  | {
      kind: "switch_product";
      fromProductId: string | null;
      fromProductName: string | null;
      toProductId: string | null;
      toProductName: string | null;
      pnl: number | null; // yuan at the UI layer
    };

export type StagedOperationKind = StagedOperation["kind"];

/** Editable metadata, in UI units (yuan, not cents). */
export interface UnitFormSnapshot {
  unitCode: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string;
  tactics: string;
  startDate: string | null;
  note: string | null;
}

export interface UnitMetadataPatch {
  unitCode?: string;
  amountCents?: number;
  currency?: string;
  status?: string;
  strategy?: string;
  tactics?: string;
  startDate?: string | null;
  unitNote?: string | null;
}

export interface CommitPayload {
  expected: ExpectedUnitSnapshot;
  metadata?: UnitMetadataPatch;
  operations: Array<Record<string, unknown>>;
  operationDate?: string;
  commitNote?: string | null;
}

function toCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** Replaces any existing operation of the same kind; never mutates. */
export function stageOperation(
  current: StagedOperation[],
  next: StagedOperation,
): StagedOperation[] {
  return [...current.filter((o) => o.kind !== next.kind), next];
}

export function unstageOperation(
  current: StagedOperation[],
  kind: StagedOperationKind,
): StagedOperation[] {
  return current.filter((o) => o.kind !== kind);
}

export function findStagedOperation<K extends StagedOperationKind>(
  operations: StagedOperation[],
  kind: K,
): Extract<StagedOperation, { kind: K }> | undefined {
  return operations.find((o) => o.kind === kind) as
    | Extract<StagedOperation, { kind: K }>
    | undefined;
}

/** Card title for the pending-changes list. */
export function describeStagedOperation(op: StagedOperation): string {
  if (op.kind === "swap_unit_code") {
    return `番号对换 → ${op.targetUnitCode}`;
  }
  const from = op.fromProductName ?? "未关联";
  const to = op.toProductName ?? "未关联";
  return `切换产品 ${from} → ${to}`;
}

/** Only fields that actually differ, converted to the worker's shape. */
export function buildUnitMetadataDiff(
  initial: UnitFormSnapshot,
  current: UnitFormSnapshot,
): UnitMetadataPatch | null {
  const patch: UnitMetadataPatch = {};

  if (initial.unitCode !== current.unitCode) patch.unitCode = current.unitCode;
  if (initial.amount !== current.amount) patch.amountCents = toCents(current.amount);
  if (initial.currency !== current.currency) patch.currency = current.currency;
  if (initial.status !== current.status) patch.status = current.status;
  if (initial.strategy !== current.strategy) patch.strategy = current.strategy;
  if (initial.tactics !== current.tactics) patch.tactics = current.tactics;
  if (initial.startDate !== current.startDate) patch.startDate = current.startDate;
  if (initial.note !== current.note) patch.unitNote = current.note;

  return Object.keys(patch).length > 0 ? patch : null;
}

/** True when the staged set forbids editing this field (docs/003 § Decision C). */
export function isUnitCodeLocked(operations: StagedOperation[]): boolean {
  return operations.some((o) => o.kind === "swap_unit_code");
}

export function isAmountLocked(operations: StagedOperation[]): boolean {
  return operations.some((o) => o.kind === "switch_product");
}

export interface BuildCommitPayloadInput {
  expected: ExpectedUnitSnapshot;
  initial: UnitFormSnapshot;
  current: UnitFormSnapshot;
  operations: StagedOperation[];
  commitNote?: string | null;
  operationDate?: string | null;
}

/** Returns null when there is genuinely nothing to send. */
export function buildCommitPayload(input: BuildCommitPayloadInput): CommitPayload | null {
  const { expected, initial, current, operations, commitNote, operationDate } = input;

  const metadata = buildUnitMetadataDiff(initial, current);
  const note = commitNote?.trim() ?? "";

  if (!metadata && operations.length === 0 && note === "") return null;

  const payload: CommitPayload = {
    expected,
    operations: operations.map((op) =>
      op.kind === "swap_unit_code"
        ? { kind: op.kind, targetUnitId: op.targetUnitId }
        : {
            kind: op.kind,
            toProductId: op.toProductId,
            ...(op.pnl != null ? { pnlCents: toCents(op.pnl) } : {}),
          },
    ),
  };

  if (metadata) payload.metadata = metadata;
  if (note !== "") payload.commitNote = note;
  if (operationDate) payload.operationDate = operationDate;

  return payload;
}

/** Units eligible as a swap partner: anything but the unit being edited. */
export function eligibleSwapTargets(
  units: SerializedUnit[],
  currentUnitId: string,
): SerializedUnit[] {
  return units.filter((u) => u.id !== currentUnitId);
}
