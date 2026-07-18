import axios from "axios";
import { getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

export type LivestockExpensePaymentStatus = "ADVANCE" | "PARTIAL" | "FULL";

export type LivestockExpenseHistoryFilters = {
  livestockItemId?: string;
  fromDate?: string;
  toDate?: string;
};

export type LivestockExpenseHistoryEntry = {
  id: string;
  livestockItemId: string;
  livestockItem: { name: string };
  supplierName: string;
  supplierContact: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: LivestockExpensePaymentStatus;
  remarks: string | null;
  createdAt: string;
};

type LivestockExpenseHistoryApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  items?: unknown;
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

function parsePaymentStatus(value: unknown): LivestockExpensePaymentStatus | null {
  if (value === "ADVANCE" || value === "PARTIAL" || value === "FULL") return value;
  return null;
}

function parseEntry(raw: unknown, index: number): LivestockExpenseHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string"
      ? o.id
      : typeof o._id === "string"
        ? o._id
        : `expense-${index}`;
  const livestockItemId =
    typeof o.livestockItemId === "string" ? o.livestockItemId : null;
  const supplierName =
    typeof o.supplierName === "string" ? o.supplierName.trim() : null;
  const totalAmount = parseNum(o.totalAmount);
  const paidAmount = parseNum(o.paidAmount);
  const dueAmount = parseNum(o.dueAmount);
  const paymentStatus = parsePaymentStatus(o.paymentStatus);
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : null;

  if (
    !livestockItemId ||
    !supplierName ||
    totalAmount == null ||
    paidAmount == null ||
    dueAmount == null ||
    !paymentStatus ||
    !createdAt
  ) {
    return null;
  }

  let itemName = "—";
  const itemRaw = o.livestockItem;
  if (itemRaw && typeof itemRaw === "object") {
    const name = (itemRaw as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) itemName = name.trim();
  }

  const supplierContact =
    typeof o.supplierContact === "string" && o.supplierContact.trim()
      ? o.supplierContact.trim()
      : null;
  const remarks =
    typeof o.remarks === "string" && o.remarks.trim() ? o.remarks.trim() : null;

  return {
    id,
    livestockItemId,
    livestockItem: { name: itemName },
    supplierName,
    supplierContact,
    totalAmount,
    paidAmount,
    dueAmount,
    paymentStatus,
    remarks,
    createdAt,
  };
}

function extractList(payload: LivestockExpenseHistoryApiResponse): unknown[] {
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).data;
    if (Array.isArray(nested)) return nested;
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
  }
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function buildRequestBody(
  filters: LivestockExpenseHistoryFilters
): Record<string, string> {
  const body: Record<string, string> = {};
  const livestockItemId = filters.livestockItemId?.trim();
  if (livestockItemId) body.livestockItemId = livestockItemId;
  const fromDate = filters.fromDate?.trim();
  if (fromDate) body.fromDate = fromDate;
  const toDate = filters.toDate?.trim();
  if (toDate) body.toDate = toDate;
  return body;
}

function localCalendarDayFromIso(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    const s = iso.trim();
    return s.length >= 10 ? s.slice(0, 10) : "";
  }
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesDateFilters(
  row: LivestockExpenseHistoryEntry,
  filters: LivestockExpenseHistoryFilters
): boolean {
  const day = localCalendarDayFromIso(row.createdAt);
  if (filters.fromDate?.trim() && day && day < filters.fromDate.trim()) return false;
  if (filters.toDate?.trim() && day && day > filters.toDate.trim()) return false;
  return true;
}

function sortByCreatedAtDesc(rows: LivestockExpenseHistoryEntry[]): LivestockExpenseHistoryEntry[] {
  return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

/**
 * GET livestock restock expense history with JSON body (axios — `fetch` cannot attach a body to GET).
 */
export async function getLivestockExpenseHistory(
  filters: LivestockExpenseHistoryFilters
): Promise<
  | { ok: true; data: LivestockExpenseHistoryEntry[] }
  | { ok: false; error: string; status: number }
> {
  const url = `${getBaseUrl()}${PRODUCT_ROUTES.LIVESTOCK_EXPENSE_HISTORY}`;
  const body = buildRequestBody(filters);

  const requestWithToken = (token: string | null) =>
    axios.get<LivestockExpenseHistoryApiResponse>(url, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      withCredentials: true,
      validateStatus: () => true,
    });

  try {
    let res = await requestWithToken(getAuthToken());
    res = await retryAfterUnauthorized(res, requestWithToken);

    if (res.status < 200 || res.status >= 300) {
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
    const data = sortByCreatedAtDesc(
      list
        .map((row, i) => parseEntry(row, i))
        .filter((x): x is LivestockExpenseHistoryEntry => x != null)
        .filter((row) => matchesDateFilters(row, filters))
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}
