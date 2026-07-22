import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import { CREDITOR_ROUTES } from "@/lib/api/routes";
import { toApiPaymentMethod, type SalePaymentMethod } from "@/lib/salePaymentMethods";
import type { CreditorFormValues } from "@/schema/creditor";

export type Creditor = {
  id: string;
  name: string;
  address: string;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
  /** Present when the list endpoint includes balance (defensive parse). */
  pendingAmount?: number;
  totalAmount?: number;
  note?: string;
};

export type PayLaterSourceType = "POS" | "LIVESTOCK" | "WASTE";

/** Discriminated by which id field is present per sourceType. */
export type PayLaterItem =
  | { productId: string; name: string; weight: number; unitPrice: number; amount: number }
  | { livestockItemId: string; name: string; quantity: number; amount: number }
  | { wasteProductId: string; name: string; weight: number; amount: number };

export type PayLaterPayload = {
  creditorId: string;
  outletId: string;
  sourceType: PayLaterSourceType;
  sourceTransactionId: string;
  items?: PayLaterItem[];
  totalAmount?: number;
  note?: string;
};

export type CreditorPaymentMethod = SalePaymentMethod;

export type CreditorPayment = {
  id?: string;
  amount: number;
  discountAmount?: number;
  paymentMethod?: string;
  reference?: string;
  createdAt?: string;
};

export type CreditorSettlement = {
  payment: CreditorPayment;
  creditorId: string;
  totalCreditAmount: number;
  totalSettledAmount: number;
  remainingBalance: number;
  settlementStatus: "PAID" | "PARTIALLY_PAID";
};

export type CreditorOrderItem = Record<string, unknown>;

export type CreditorOrder = {
  id?: string;
  sourceType?: string;
  sourceTransactionId?: string;
  totalAmount?: number;
  outlet?: { id?: string; name?: string };
  items?: CreditorOrderItem[];
  createdAt?: string;
};

export type CreditorDetail = Creditor & {
  totalAmount: number;
  pendingAmount: number;
  orders: CreditorOrder[];
  payments: CreditorPayment[];
};

export type PayCreditorPayload = {
  amount: number;
  discountAmount?: number;
  paymentMethod: CreditorPaymentMethod;
  outletId: string;
  reference?: string;
};

type CreditorMutationResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") return value;
  return value == null ? null : String(value);
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function parseCreditor(raw: unknown): Creditor | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" ? o.name : null;
  const phone =
    typeof o.phone === "string"
      ? o.phone
      : typeof o.contact === "string"
        ? o.contact
        : null;
  const address =
    typeof o.address === "string"
      ? o.address
      : stringOrNull(o.address) ?? "";
  if (!id || !name || !phone) return null;
  const creditor: Creditor = { id, name, address, phone };
  if (typeof o.createdAt === "string") creditor.createdAt = o.createdAt;
  if (typeof o.updatedAt === "string") creditor.updatedAt = o.updatedAt;
  const pending = getNumber(o.pendingAmount);
  if (pending != null) creditor.pendingAmount = pending;
  const total = getNumber(o.totalAmount);
  if (total != null) creditor.totalAmount = total;
  return creditor;
}

function normalizeCreditorList(data: CreditorMutationResponse | unknown): Creditor[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  let list: unknown[] | null = null;
  if (Array.isArray(o.data)) list = o.data;
  else if (Array.isArray(o.creditors)) list = o.creditors;
  else if (Array.isArray(o)) list = o;
  if (!list) return [];
  return list
    .map(parseCreditor)
    .filter((c): c is Creditor => c !== null);
}

export function parseCreditorPayment(raw: unknown): CreditorPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const amount = getNumber(o.amount);
  if (amount == null) return null;
  const payment: CreditorPayment = { amount };
  const id = stringOrNull(o.id);
  if (id) payment.id = id;
  const discount = getNumber(o.discountAmount);
  if (discount != null) payment.discountAmount = discount;
  const method = stringOrNull(o.paymentMethod);
  if (method) payment.paymentMethod = method;
  const reference = stringOrNull(o.reference);
  if (reference) payment.reference = reference;
  const createdAt = stringOrNull(o.createdAt);
  if (createdAt) payment.createdAt = createdAt;
  return payment;
}

export function parseCreditorOrder(raw: unknown): CreditorOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const order: CreditorOrder = {};
  const id = stringOrNull(o.id);
  if (id) order.id = id;
  const sourceType = stringOrNull(o.sourceType);
  if (sourceType) order.sourceType = sourceType;
  const sourceTxn = stringOrNull(o.sourceTransactionId);
  if (sourceTxn) order.sourceTransactionId = sourceTxn;
  const total = getNumber(o.totalAmount) ?? getNumber(o.amount);
  if (total != null) order.totalAmount = total;
  const outletRaw = o.outlet;
  if (outletRaw && typeof outletRaw === "object") {
    const inner = outletRaw as Record<string, unknown>;
    const outlet: { id?: string; name?: string } = {};
    const oid = stringOrNull(inner.id);
    if (oid) outlet.id = oid;
    const oname = stringOrNull(inner.name);
    if (oname) outlet.name = oname;
    order.outlet = outlet;
  }
  if (Array.isArray(o.items)) order.items = o.items as CreditorOrderItem[];
  const createdAt = stringOrNull(o.createdAt) ?? stringOrNull(o.date);
  if (createdAt) order.createdAt = createdAt;
  return order;
}

export function parseCreditorDetail(raw: unknown): CreditorDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const creditor = parseCreditor(raw);
  if (!creditor) return null;
  const o = raw as Record<string, unknown>;
  const totalAmount = getNumber(o.totalAmount) ?? 0;
  const pendingAmount = getNumber(o.pendingAmount) ?? 0;
  const ordersRaw = Array.isArray(o.orders) ? o.orders : [];
  const paymentsRaw = Array.isArray(o.payments) ? o.payments : [];
  const detail: CreditorDetail = {
    ...creditor,
    totalAmount,
    pendingAmount,
    orders: ordersRaw
      .map(parseCreditorOrder)
      .filter((x): x is CreditorOrder => x !== null),
    payments: paymentsRaw
      .map(parseCreditorPayment)
      .filter((x): x is CreditorPayment => x !== null),
  };
  return detail;
}

/**
 * GET /v1/creditors — list/search creditors.
 * `search` matches name, phone, or address server-side.
 */
export async function getCreditors(
  search?: string
): Promise<
  | { ok: true; data: Creditor[] }
  | { ok: false; error: string; status: number }
> {
  const trimmed = search?.trim();
  const route =
    trimmed && trimmed.length > 0
      ? `${CREDITOR_ROUTES.ROOT}?search=${encodeURIComponent(trimmed)}`
      : CREDITOR_ROUTES.ROOT;

  const result = await apiRequest<CreditorMutationResponse>(route, { method: "GET" });
  if (!result.ok) return result;
  if (result.data && typeof result.data === "object" && result.data.success === false) {
    return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  }
  return { ok: true, data: normalizeCreditorList(result.data) };
}

/** POST /v1/creditors — create a new creditor. */
export async function createCreditor(
  values: CreditorFormValues
): Promise<
  | { ok: true; data: Creditor | null }
  | { ok: false; error: string; status: number }
> {
  const body = {
    name: values.name.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
  };
  const result = await apiRequest<CreditorMutationResponse>(CREDITOR_ROUTES.ROOT, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  if (result.data && typeof result.data === "object" && result.data.success === false) {
    return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  }
  const raw =
    (result.data && typeof result.data === "object" ? result.data.data : null) ??
    result.data;
  const created = parseCreditor(raw);
  return { ok: true, data: created };
}

/** GET /v1/creditors/:creditorId — detail with balance, orders, payments. */
export async function getCreditorDetail(
  creditorId: string
): Promise<
  | { ok: true; data: CreditorDetail }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<CreditorMutationResponse>(
    CREDITOR_ROUTES.DETAIL(creditorId),
    { method: "GET" }
  );
  if (!result.ok) return result;
  if (result.data && typeof result.data === "object" && result.data.success === false) {
    return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  }
  const raw =
    (result.data && typeof result.data === "object" ? result.data.data : null) ??
    result.data;
  const detail = parseCreditorDetail(raw);
  if (!detail) {
    return { ok: false, error: "Creditor not found.", status: 404 };
  }
  return { ok: true, data: detail };
}

/** POST /v1/creditors/:creditorId/payments — settle pending balance. */
export async function payCreditor(
  creditorId: string,
  payload: PayCreditorPayload
): Promise<
  | { ok: true; data: CreditorSettlement }
  | { ok: false; error: string; status: number }
> {
  const body = {
    amount: payload.amount,
    discountAmount: payload.discountAmount ?? 0,
    paymentMethod: toApiPaymentMethod(payload.paymentMethod),
    outletId: payload.outletId,
    reference: payload.reference?.trim() || undefined,
  };
  const result = await apiRequest<CreditorMutationResponse>(
    CREDITOR_ROUTES.PAYMENTS(creditorId),
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  if (!result.ok) return result;
  if (result.data && typeof result.data === "object" && result.data.success === false) {
    return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  }
  const raw = result.data?.data;
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid creditor payment response.", status: 422 };
  const o = raw as Record<string, unknown>;
  const payment = parseCreditorPayment(o.payment);
  const responseCreditorId = stringOrNull(o.creditorId);
  const totalCreditAmount = getNumber(o.totalCreditAmount);
  const totalSettledAmount = getNumber(o.totalSettledAmount);
  const remainingBalance = getNumber(o.remainingBalance);
  const settlementStatus = o.settlementStatus;
  if (!payment || !responseCreditorId || totalCreditAmount == null || totalSettledAmount == null || remainingBalance == null || (settlementStatus !== "PAID" && settlementStatus !== "PARTIALLY_PAID")) return { ok: false, error: "Invalid creditor payment response.", status: 422 };
  return { ok: true, data: { payment, creditorId: responseCreditorId, totalCreditAmount, totalSettledAmount, remainingBalance, settlementStatus } };
}

/** POST /v1/creditors/pay-later — record a sale on credit. */
export async function createCreditorPayLater(
  payload: PayLaterPayload
): Promise<
  | { ok: true; data: CreditorMutationResponse }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<CreditorMutationResponse>(CREDITOR_ROUTES.PAY_LATER, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) return result;
  if (result.data && typeof result.data === "object" && result.data.success === false) {
    return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  }
  return result;
}




export type CreditorScope = { type: "OUTLET"; outletId: string } | { type: "ALL_OUTLETS" };
export type CreditorSummary = { totalCreditAmount: number; totalPaidAmount: number; totalPendingAmount: number; creditTransactions: number; pendingTransactions: number; paidTransactions: number; fullyPaidTransactions: number; creditorsWithPendingCredit: number; creditorsWhoPaid: number };
export type CreditorTransaction = { id: string; creditor: Creditor; outlet: { id: string; name: string }; sourceType: PayLaterSourceType; sourceTransactionId: string | null; items: unknown; totalAmount: number; paidAmount: number; pendingAmount: number; status: "PENDING" | "PARTIALLY_PAID" | "PAID"; createdAt: string; updatedAt: string; payments: Array<{ allocationId: string; amount: number; paymentId: string; paymentMethod: "CASH" | "ONLINE" | "CHEQUE"; reference: string | null; receivedAtOutlet: { id: string; name: string }; paidAt: string }> };
export type CreditorReport = { scope: CreditorScope; summary: CreditorSummary; transactions: CreditorTransaction[] };
export type CreditorDashboard = Omit<CreditorReport, "transactions"> & { byOutlet: Array<{ outletId: string; outletName: string; creditTransactions: number; paidTransactions: number; totalCreditAmount: number; totalPaidAmount: number; totalPendingAmount: number }>; creditors: CreditorTransaction[]; creditorsPaid: CreditorTransaction[] };
async function getCreditorReport<T>(route: string, outletId?: string): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const path = outletId?.trim() ? `${route}?outletId=${encodeURIComponent(outletId.trim())}` : route;
  const result = await apiRequest<CreditorMutationResponse>(path, { method: "GET" });
  if (!result.ok) return result;
  if (result.data?.success === false) return { ok: false, error: errorMessageFromPayload(result.data), status: 400 };
  return { ok: true, data: (result.data?.data ?? result.data) as T };
}
export const getCreditorDashboard = (outletId?: string) => getCreditorReport<CreditorDashboard>(CREDITOR_ROUTES.DASHBOARD, outletId);
export const getOutstandingCreditorOrders = (outletId?: string) => getCreditorReport<CreditorReport>(CREDITOR_ROUTES.CREDIT, outletId);
export const getPaidCreditorOrders = (outletId?: string) => getCreditorReport<CreditorReport>(CREDITOR_ROUTES.PAID, outletId);


