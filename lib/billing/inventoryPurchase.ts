export type InventoryPaymentStatus = "ADVANCE" | "PARTIAL" | "FULL";

export type InventoryPurchaseFields = {
  supplierId?: string;
  supplierName?: string;
  supplierContact?: string;
  totalAmount?: string;
  paidAmount?: string;
  dueAmount?: string;
  paymentStatus?: string;
  remarks?: string;
};

export type InventoryPurchaseDefaults = { quantity: number; buyingPrice: number };
export type InventoryPurchaseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function parseOptionalNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildInventoryPurchasePayload(fields: InventoryPurchaseFields, defaults: InventoryPurchaseDefaults): InventoryPurchaseResult {
  const totalAmount = parseOptionalNumber(fields.totalAmount) ?? defaults.quantity * defaults.buyingPrice;
  const paidAmount = parseOptionalNumber(fields.paidAmount) ?? totalAmount;
  const dueAmount = parseOptionalNumber(fields.dueAmount) ?? totalAmount - paidAmount;
  const status = fields.paymentStatus || "FULL";
  if (![totalAmount, paidAmount, dueAmount].every((value) => Number.isFinite(value) && value >= 0)) {
    return { ok: false, error: "Purchase amounts must be valid non-negative numbers." };
  }
  if (paidAmount > totalAmount) return { ok: false, error: "Paid amount cannot exceed total amount." };
  if (Math.abs(paidAmount + dueAmount - totalAmount) > 0.005) {
    return { ok: false, error: "Paid amount and due amount must equal total amount." };
  }
  if (status !== "ADVANCE" && status !== "PARTIAL" && status !== "FULL") {
    return { ok: false, error: "Payment status is invalid." };
  }
  const payload: Record<string, unknown> = { totalAmount, paidAmount, dueAmount, paymentStatus: status };
  for (const key of ["supplierId", "supplierName", "supplierContact", "remarks"] as const) {
    const value = fields[key]?.trim();
    if (value) payload[key] = value;
  }
  return { ok: true, data: payload };
}