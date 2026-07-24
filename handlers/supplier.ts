import axios from "axios";
import type { SupplierFormValues } from "@/schema/supplier";
import { apiRequest, getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { SUPPLIER_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  outletId: string | null;
  status: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  summary?: SupplierSummary;
};

export type SupplierPaymentStatus = "ADVANCE" | "PARTIAL" | "FULL";
export type SupplierPurchaseType = "LIVESTOCK_ADD" | "LIVESTOCK_RESTOCK" | "ITEM_ADD" | "ITEM_RESTOCK";
export type SupplierSummary = {
  totalTransactions: number;
  fullyPaidTransactions: number;
  partialTransactions: number;
  advanceTransactions: number;
  totalPurchasedAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
};
export type SupplierPurchase = {
  id: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: SupplierPaymentStatus;
  purchaseType: SupplierPurchaseType | null;
  createdAt: string;
  remarks?: string | null;
  inventoryItem?: { id: string; name: string } | null;
  livestockItem?: { id: string; name: string; itemId?: string | null } | null;
  outlet?: { id: string; name: string } | null;
};
export type SupplierDetails = Supplier & {
  outlet?: { id: string; name: string } | null;
  summary: SupplierSummary;
  purchases: SupplierPurchase[];
};
export type SupplierPurchaseFilters = {
  outletId?: string;
  paymentStatus?: SupplierPaymentStatus;
  purchaseType?: SupplierPurchaseType;
  from?: string;
  to?: string;
};
export type RecordSupplierPaymentPayload = { amount: number };

export type CreateSupplierPayload = SupplierFormValues & { createdBy?: string };
export type UpdateSupplierPayload = SupplierFormValues & { id: string; updatedBy?: string };

export type SupplierResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  suppliers?: Supplier[];
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

const emptySummary: SupplierSummary = {
  totalTransactions: 0, fullyPaidTransactions: 0, partialTransactions: 0,
  advanceTransactions: 0, totalPurchasedAmount: 0, totalPaidAmount: 0, totalDueAmount: 0,
};
type SupplierMutationResult =
  | { ok: true; data: SupplierResponse }
  | { ok: false; error: string; status: number };
function finite(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeSummary(value: unknown): SupplierSummary {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(emptySummary).map((key) => [key, finite(row[key])])) as SupplierSummary;
}
export function normalizeSupplierPurchase(value: unknown): SupplierPurchase | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    totalAmount: finite(row.totalAmount),
    paidAmount: finite(row.paidAmount),
    dueAmount: finite(row.dueAmount),
    paymentStatus: (row.paymentStatus as SupplierPaymentStatus) ?? "PARTIAL",
    purchaseType: (row.purchaseType as SupplierPurchaseType) ?? null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    remarks: stringOrNull(row.remarks),
    inventoryItem: row.inventoryItem as SupplierPurchase["inventoryItem"],
    livestockItem: row.livestockItem as SupplierPurchase["livestockItem"],
    outlet: row.outlet as SupplierPurchase["outlet"],
  };
}

function queryRoute(route: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); });
  const text = query.toString();
  return text ? `${route}?${text}` : route;
}

export async function getSupplierDetails(id: string, outletId?: string) {
  const result = await apiRequest<SupplierResponse>(queryRoute(SUPPLIER_ROUTES.DETAILS(id), { outletId }), { method: "GET" });
  if (!result.ok) return result;
  const failure = failedResponse(result.data);
  if (failure) return failure;
  const raw = result.data.data;
  const supplier = normalizeSupplier(raw);
  if (!supplier || !raw || typeof raw !== "object") return { ok: false as const, error: "Supplier not found", status: 404 };
  const row = raw as Record<string, unknown>;
  return { ok: true as const, data: {
    ...supplier,
    outlet: row.outlet as SupplierDetails["outlet"],
    summary: normalizeSummary(row.summary),
    purchases: Array.isArray(row.purchases) ? row.purchases.map(normalizeSupplierPurchase).filter((x): x is SupplierPurchase => x !== null) : [],
  }};
}

export async function getSupplierPurchases(id: string, filters: SupplierPurchaseFilters = {}) {
  const result = await apiRequest<SupplierResponse>(queryRoute(SUPPLIER_ROUTES.PURCHASES(id), filters), { method: "GET" });
  if (!result.ok) return result;
  const failure = failedResponse(result.data);
  if (failure) return failure;
  const row = result.data.data && typeof result.data.data === "object" ? result.data.data as unknown as Record<string, unknown> : {};
  return { ok: true as const, data: {
    summary: normalizeSummary(row.summary),
    purchases: Array.isArray(row.purchases) ? row.purchases.map(normalizeSupplierPurchase).filter((x): x is SupplierPurchase => x !== null) : [],
  }};
}

export async function recordSupplierPayment(id: string, expenseId: string, payload: RecordSupplierPaymentPayload) {
  return apiRequest<SupplierResponse>(SUPPLIER_ROUTES.PAYMENT(id, expenseId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function normalizeSupplier(raw: unknown): Supplier | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    contact: stringOrNull(row.contact),
    outletId: stringOrNull(row.outletId),
    status: row.status === true || row.status === "true",
    createdBy: stringOrNull(row.createdBy),
    updatedBy: stringOrNull(row.updatedBy),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
    deletedAt: stringOrNull(row.deletedAt),
    summary: row.summary && typeof row.summary === "object" ? normalizeSummary(row.summary) : undefined,
  };
}

function failedResponse(data: SupplierResponse): { ok: false; error: string; status: number } | null {
  if (data.success !== false) return null;
  return { ok: false, error: errorMessageFromPayload(data), status: 400 };
}

export async function getSuppliers(
  outletId?: string | null
): Promise<{ ok: true; data: Supplier[] } | { ok: false; error: string; status: number }> {
  const trimmed = outletId?.trim();
  const route = trimmed
    ? SUPPLIER_ROUTES.GET + "?outletId=" + encodeURIComponent(trimmed)
    : SUPPLIER_ROUTES.GET;
  const result = await apiRequest<SupplierResponse>(route, { method: "GET" });
  if (!result.ok) return result;
  const failure = failedResponse(result.data);
  if (failure) return failure;
  const list = Array.isArray(result.data.data)
    ? result.data.data
    : Array.isArray(result.data.suppliers)
      ? result.data.suppliers
      : [];
  return { ok: true, data: list.map(normalizeSupplier).filter((x): x is Supplier => x !== null) };
}

export async function getActiveSuppliers(outletId?: string | null): Promise<
  { ok: true; data: Supplier[] } | { ok: false; error: string; status: number }
> {
  const result = await getSuppliers(outletId);
  return result.ok ? { ok: true, data: result.data.filter((supplier) => supplier.status) } : result;
}

export async function getSupplierById(
  id: string
): Promise<{ ok: true; data: Supplier } | { ok: false; error: string; status: number }> {
  const base = getBaseUrl();
  if (!base.trim()) return { ok: false, error: "API base URL is not configured.", status: 0 };

  const requestWithToken = (token: string | null) =>
    axios.request<SupplierResponse>({
      method: "GET",
      url: base + SUPPLIER_ROUTES.GET_BY_ID,
      data: { id },
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      withCredentials: true,
      validateStatus: () => true,
    });

  try {
    let response = await requestWithToken(getAuthToken());
    response = await retryAfterUnauthorized(response, requestWithToken);

    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: errorMessageFromPayload(response.data), status: response.status };
    }
    const failure = failedResponse(response.data);
    if (failure) return failure;
    const supplier = normalizeSupplier(response.data.data);
    return supplier ? { ok: true, data: supplier } : { ok: false, error: "Supplier not found", status: 400 };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<SupplierMutationResult> {
  const body: CreateSupplierPayload = {
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    ...(payload.createdBy ? { createdBy: payload.createdBy } : {}),
  };
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  return failedResponse(result.data) ?? result;
}

export async function updateSupplier(payload: UpdateSupplierPayload): Promise<SupplierMutationResult> {
  const body: UpdateSupplierPayload = {
    id: payload.id,
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    ...(payload.updatedBy ? { updatedBy: payload.updatedBy } : {}),
  };
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;
  return failedResponse(result.data) ?? result;
}

export async function deleteSupplier(id: string): Promise<SupplierMutationResult> {
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  if (!result.ok) return result;
  return failedResponse(result.data) ?? result;
}
