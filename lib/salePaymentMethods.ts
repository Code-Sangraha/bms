/** Values used in UI state for sale payment method selectors. */
export const SALE_PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
  { value: "cheque", label: "Cheque" },
] as const;

export type SalePaymentMethod = (typeof SALE_PAYMENT_METHOD_OPTIONS)[number]["value"];

/** Prisma `PaymentMethodEnum` values returned/sent by the backend API. */
export type ApiPaymentMethod = "CASH" | "ONLINE" | "CHEQUE";

export const DEFAULT_SALE_PAYMENT_METHOD: SalePaymentMethod = "cash";

/**
 * UI-only sentinel for "Pay Later" in sale payment pickers. It is NEVER sent to
 * the sales API — when a sale is paid on credit, the underlying sale is created
 * with a real method (typically CASH) and a separate `/v1/creditors/pay-later`
 * call records the debt. Kept out of `SalePaymentMethod` so backend payloads
 * cannot accidentally carry it.
 */
export const PAY_LATER_UI_VALUE = "payLater" as const;

export type SalePaymentSelection = SalePaymentMethod | typeof PAY_LATER_UI_VALUE;

export function isPayLaterSelection(value: unknown): value is typeof PAY_LATER_UI_VALUE {
  return value === PAY_LATER_UI_VALUE;
}

/**
 * Resolves a `SalePaymentSelection` to a real `SalePaymentMethod` for the sales
 * API. Pay-later defaults to the CASH sentinel (per product decision); callers
 * may override by passing `fallback`.
 */
export function resolveSalePaymentMethod(
  value: SalePaymentSelection | string,
  fallback: SalePaymentMethod = "cash",
): SalePaymentMethod {
  if (isPayLaterSelection(value)) return fallback;
  const normalized = String(value).trim().toLowerCase() as SalePaymentMethod;
  if (normalized === "cash" || normalized === "online" || normalized === "cheque") {
    return normalized;
  }
  return fallback;
}

const UI_TO_API: Record<SalePaymentMethod, ApiPaymentMethod> = {
  cash: "CASH",
  online: "ONLINE",
  cheque: "CHEQUE",
};

const API_TO_UI: Record<ApiPaymentMethod, SalePaymentMethod> = {
  CASH: "cash",
  ONLINE: "online",
  CHEQUE: "cheque",
};

export function toApiPaymentMethod(value: SalePaymentMethod | string): ApiPaymentMethod {
  const normalized = value.trim().toLowerCase() as SalePaymentMethod;
  if (normalized in UI_TO_API) return UI_TO_API[normalized];
  const upper = value.trim().toUpperCase();
  if (upper === "CASH" || upper === "ONLINE" || upper === "CHEQUE") {
    return upper as ApiPaymentMethod;
  }
  return "CASH";
}

export function fromApiPaymentMethod(value: string | null | undefined): SalePaymentMethod | null {
  if (value == null || !value.trim()) return null;
  const upper = value.trim().toUpperCase() as ApiPaymentMethod;
  if (upper in API_TO_UI) return API_TO_UI[upper];
  const lower = value.trim().toLowerCase() as SalePaymentMethod;
  if (lower in UI_TO_API) return lower;
  return null;
}

export function paymentMethodLabel(value: SalePaymentMethod | string | null | undefined): string {
  const uiValue = typeof value === "string" ? fromApiPaymentMethod(value) ?? (value as SalePaymentMethod) : value;
  const opt = SALE_PAYMENT_METHOD_OPTIONS.find((o) => o.value === uiValue);
  return opt?.label ?? (typeof value === "string" ? value : "Cash");
}
