/** Values sent as `paymentMethod` on sale API payloads. */
export const SALE_PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
  { value: "cheque", label: "Cheque" },
] as const;

export type SalePaymentMethod = (typeof SALE_PAYMENT_METHOD_OPTIONS)[number]["value"];

export const DEFAULT_SALE_PAYMENT_METHOD: SalePaymentMethod = "cash";
