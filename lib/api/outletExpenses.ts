import axios from "axios";
import { getBaseUrl, tryRefresh } from "@/lib/api/client";
import { OUTLET_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

export type OutletExpensePaymentStatus = "ADVANCE" | "PARTIAL" | "FULL";

export type OutletExpenseFilters = {
  outletId?: string;
};

export type OutletExpenseEntry = {
  id: string;
  outletId: string;
  outlet: { id: string; name: string };
  livestockItemId: string;
  livestockItem: { id: string; name: string };
  supplierName: string;
  supplierContact: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: OutletExpensePaymentStatus;
  remarks: string | null;
  createdBy: string | null;
};

type OutletExpensesApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

function parseNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parsePaymentStatus(value: unknown): OutletExpensePaymentStatus | null {
  if (value === "ADVANCE" || value === "PARTIAL" || value === "FULL") return value;
  return null;
}

function parseNestedEntity(
  raw: unknown,
  idKey: string
): { id: string; name: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!id || !name) {
    const fallbackId = typeof o[idKey] === "string" ? (o[idKey] as string) : null;
    if (!fallbackId || !name) return null;
    return { id: fallbackId, name };
  }
  return { id, name };
}

function parseEntry(raw: unknown, index: number): OutletExpenseEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string"
      ? o.id
      : typeof o._id === "string"
        ? o._id
        : `expense-${index}`;

  const outletId = typeof o.outletId === "string" ? o.outletId : null;
  const livestockItemId =
    typeof o.livestockItemId === "string" ? o.livestockItemId : null;
  const supplierName =
    typeof o.supplierName === "string" ? o.supplierName.trim() : null;
  const totalAmount = parseNum(o.totalAmount);
  const paidAmount = parseNum(o.paidAmount);
  const dueAmount = parseNum(o.dueAmount);
  const paymentStatus = parsePaymentStatus(o.paymentStatus);

  if (
    !outletId ||
    !livestockItemId ||
    !supplierName ||
    totalAmount == null ||
    paidAmount == null ||
    dueAmount == null ||
    !paymentStatus
  ) {
    return null;
  }

  const outlet =
    parseNestedEntity(o.outlet, "outletId") ?? { id: outletId, name: "—" };
  const livestockItem =
    parseNestedEntity(o.livestockItem, "livestockItemId") ?? {
      id: livestockItemId,
      name: "—",
    };

  const supplierContact =
    typeof o.supplierContact === "string" && o.supplierContact.trim()
      ? o.supplierContact.trim()
      : null;
  const remarks =
    typeof o.remarks === "string" && o.remarks.trim() ? o.remarks.trim() : null;
  const createdBy =
    typeof o.createdBy === "string" && o.createdBy.trim()
      ? o.createdBy.trim()
      : null;

  return {
    id,
    outletId,
    outlet,
    livestockItemId,
    livestockItem,
    supplierName,
    supplierContact,
    totalAmount,
    paidAmount,
    dueAmount,
    paymentStatus,
    remarks,
    createdBy,
  };
}

function extractList(payload: OutletExpensesApiResponse): unknown[] {
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).data;
    if (Array.isArray(nested)) return nested;
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

function buildRequestBody(filters: OutletExpenseFilters): Record<string, string> {
  const body: Record<string, string> = {};
  const outletId = filters.outletId?.trim();
  if (outletId) body.outletId = outletId;
  return body;
}

function errorMessageFromPayload(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const msg = o.message ?? o.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return "Request failed.";
}

function isSuccessStatus(status: number): boolean {
  return status === 200 || status === 201;
}

/**
 * GET outlet expenses with JSON body (axios — `fetch` cannot attach a body to GET).
 * Controller may return 201 on success.
 */
export async function getOutletExpenses(
  filters: OutletExpenseFilters = {}
): Promise<
  | { ok: true; data: OutletExpenseEntry[] }
  | { ok: false; error: string; status: number }
> {
  const url = `${getBaseUrl()}${OUTLET_ROUTES.GET_EXPENSES}`;
  const body = buildRequestBody(filters);

  const requestWithToken = (token: string | null) =>
    axios.get<OutletExpensesApiResponse>(url, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      withCredentials: true,
      validateStatus: () => true,
    });

  try {
    let token = getAuthToken();
    let res = await requestWithToken(token);

    if (res.status === 401) {
      const newToken = await tryRefresh();
      if (newToken) {
        token = newToken;
        res = await requestWithToken(token);
      } else {
        clearAuthToken();
        clearStoredUser();
      }
    }

    if (!isSuccessStatus(res.status)) {
      return {
        ok: false,
        error: errorMessageFromPayload(res.data),
        status: res.status,
      };
    }

    const payload = res.data ?? {};
    if (payload.success === false) {
      return {
        ok: false,
        error: errorMessageFromPayload(payload),
        status: res.status,
      };
    }

    const list = extractList(payload);
    const data = list
      .map((row, i) => parseEntry(row, i))
      .filter((x): x is OutletExpenseEntry => x != null);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}
