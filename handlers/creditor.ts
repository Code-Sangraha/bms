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
};

export type PayLaterSourceType = "POS" | "LIVESTOCK" | "WASTE";

/** Discriminated by which id field is present per sourceType. */
export type PayLaterItem =
  | { productId: string; name: string; weight: number; unitPrice: number; amount: number }
  | { livestockItemId: string; name: string; quantity: number; amount: number }
  | { wasteProductId: string; name: string; weight: number; amount: number };

export type PayLaterPayload = {
  creditorId: string;
  sourceType: PayLaterSourceType;
  sourceTransactionId: string;
  items?: PayLaterItem[];
  totalAmount?: number;
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
  | { ok: true; data: CreditorMutationResponse }
  | { ok: false; error: string; status: number }
> {
  const body = {
    amount: payload.amount,
    discountAmount: payload.discountAmount ?? 0,
    paymentMethod: toApiPaymentMethod(payload.paymentMethod),
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
  return result;
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



