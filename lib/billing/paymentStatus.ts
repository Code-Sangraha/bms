import type { PaymentStatus } from "../../handlers/product";

export type { PaymentStatus };

/**
 * Derives the payment status from total and paid amounts.
 * - paid > total  -> ADVANCE (overpaid / prepayment)
 * - paid >= total -> FULL    (fully settled)
 * - otherwise     -> PARTIAL (some balance remaining)
 */
export function derivePaymentStatus(total: number, paid: number): PaymentStatus {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safePaid = Number.isFinite(paid) ? paid : 0;
  if (safePaid > safeTotal) return "ADVANCE";
  if (safePaid >= safeTotal) return "FULL";
  return "PARTIAL";
}

/** Outstanding balance, never negative. */
export function computeDueAmount(total: number, paid: number): number {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safePaid = Number.isFinite(paid) ? paid : 0;
  return Math.max(safeTotal - safePaid, 0);
}
