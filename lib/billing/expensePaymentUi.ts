import type { PaymentStatus } from "@/handlers/product";

/** Whether the expense row can accept a follow-up payment via complete-partial-payment. */
export function canRecordExpensePayment(status: PaymentStatus): boolean {
  return status === "PARTIAL" || status === "ADVANCE";
}
