import axios from "axios";
import { getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

export type LivestockInventoryHistoryType =
  | "RESTOCK"
  | "DEDUCT"
  | "SALE"
  | "SENT_TO_PROCESSING";

export type LivestockInventoryHistoryFilterType =
  | LivestockInventoryHistoryType
  | "CONSUMED";

export type LivestockInventoryHistoryFilters = {
  livestockItemId?: string;
  type?: LivestockInventoryHistoryFilterType;
  fromDate?: string;
  toDate?: string;
};

export type LivestockInventoryHistoryItemSnapshot = {
  name: string;
  weight: number;
  quantity: number;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
};

export type LivestockInventoryHistoryEntry = {
  id: string;
  livestockItemId: string;
  livestockItem: LivestockInventoryHistoryItemSnapshot;
  quantity: number | null;
  weight: number | null;
  type: LivestockInventoryHistoryType;
  createdAt: string;
  /** Present when API sends pricing on history rows (storage table). */
  buyingPrice?: number | null;
  sellingPrice?: number | null;
};

type LivestockInventoryHistoryApiResponse = {
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

function parseItemSnapshot(raw: unknown): LivestockInventoryHistoryItemSnapshot {
  if (!raw || typeof raw !== "object") {
    return { name: "—", weight: 0, quantity: 0 };
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const buyingPrice =
    parseNum(o.buyingPrice) ?? parseNum((o as { buying_price?: unknown }).buying_price);
  const sellingPrice =
    parseNum(o.sellingPrice) ?? parseNum((o as { selling_price?: unknown }).selling_price);
  return {
    name: name || "—",
    weight: parseNum(o.weight) ?? 0,
    quantity: parseNum(o.quantity) ?? 0,
    buyingPrice: buyingPrice ?? null,
    sellingPrice: sellingPrice ?? null,
  };
}

function parseHistoryType(raw: unknown): LivestockInventoryHistoryType | null {
  if (raw === "RESTOCK" || raw === "DEDUCT" || raw === "SALE" || raw === "SENT_TO_PROCESSING") return raw;
  if (typeof raw === "string") {
    const u = raw.toUpperCase();
    if (u === "RESTOCK" || u === "DEDUCT" || u === "SALE" || u === "SENT_TO_PROCESSING") return u;
  }
  return null;
}

function parseEntry(raw: unknown, index: number): LivestockInventoryHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    typeof row.id === "string"
      ? row.id
      : typeof row._id === "string"
        ? row._id
        : `livestock-history-${index}`;
  const nested = row.livestockItem;
  const nestedRecord = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
  const fromNested =
    nestedRecord && typeof nestedRecord.id === "string" && nestedRecord.id.trim()
      ? nestedRecord.id.trim()
      : nestedRecord && typeof nestedRecord._id === "string" && nestedRecord._id.trim()
        ? nestedRecord._id.trim()
        : nestedRecord &&
            typeof nestedRecord.livestockItemId === "string" &&
            nestedRecord.livestockItemId.trim()
          ? nestedRecord.livestockItemId.trim()
          : "";
  const fromRow =
    typeof row.livestockItemId === "string" && row.livestockItemId.trim()
      ? row.livestockItemId.trim()
      : typeof (row as { livestock_item_id?: unknown }).livestock_item_id === "string"
        ? String((row as { livestock_item_id: string }).livestock_item_id).trim()
        : typeof (row as { itemId?: unknown }).itemId === "string" && (row as { itemId: string }).itemId.trim()
          ? (row as { itemId: string }).itemId.trim()
          : "";
  /** Inventory row this history line applies to — never fall back to the history row's own `id`. */
  const livestockItemId = fromRow || fromNested;
  const livestockItem =
    nested && typeof nested === "object"
      ? parseItemSnapshot(nested)
      : {
          name: typeof row.name === "string" ? row.name : "—",
          weight: parseNum(row.weight) ?? 0,
          quantity: parseNum(row.quantity) ?? 0,
        };
  const type = parseHistoryType(row.type);
  if (!type) return null;
  const createdAtRaw = row.createdAt ?? row.created_at;
  const createdAt =
    typeof createdAtRaw === "string"
      ? createdAtRaw
      : createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : "";
  if (!createdAt) return null;
  if (!livestockItemId) return null;
  const quantity = row.quantity === null ? null : parseNum(row.quantity);
  const weight = row.weight === null ? null : parseNum(row.weight);
  const buyingPrice =
    parseNum(row.buyingPrice) ??
    parseNum(row.buyPrice) ??
    parseNum((row as { buying_price?: unknown }).buying_price);
  const sellingPrice =
    parseNum(row.sellingPrice) ??
    parseNum(row.salePrice) ??
    parseNum((row as { selling_price?: unknown }).selling_price);
  return {
    id,
    livestockItemId,
    livestockItem,
    quantity,
    weight,
    type,
    createdAt,
    buyingPrice: buyingPrice ?? null,
    sellingPrice: sellingPrice ?? null,
  };
}

function buildRequestBody(filters: LivestockInventoryHistoryFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (filters.livestockItemId?.trim()) body.livestockItemId = filters.livestockItemId.trim();
  if (
    filters.type === "RESTOCK" ||
    filters.type === "DEDUCT" ||
    filters.type === "SALE" ||
    filters.type === "SENT_TO_PROCESSING" ||
    filters.type === "CONSUMED"
  ) {
    body.type = filters.type;
  }
  if (filters.fromDate?.trim()) body.fromDate = filters.fromDate.trim();
  if (filters.toDate?.trim()) body.toDate = filters.toDate.trim();
  return body;
}

function extractList(payload: LivestockInventoryHistoryApiResponse): unknown[] {
  const nested = payload?.data;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object" && Array.isArray((nested as { items?: unknown[] }).items)) {
    return (nested as { items: unknown[] }).items;
  }
  if (Array.isArray(payload?.items)) return payload.items as unknown[];
  return [];
}

function sortByCreatedAtDesc(rows: LivestockInventoryHistoryEntry[]): LivestockInventoryHistoryEntry[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
    return b.createdAt.localeCompare(a.createdAt);
  });
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

function matchesTypeFilter(
  rowType: LivestockInventoryHistoryType,
  filterType: LivestockInventoryHistoryFilterType | undefined
): boolean {
  if (!filterType) return true;
  if (filterType === "CONSUMED") return rowType !== "RESTOCK";
  return rowType === filterType;
}

function matchesFilters(
  row: LivestockInventoryHistoryEntry,
  filters: LivestockInventoryHistoryFilters
): boolean {
  const livestockItemId = filters.livestockItemId?.trim();
  if (livestockItemId && row.livestockItemId !== livestockItemId) return false;

  if (!matchesTypeFilter(row.type, filters.type)) return false;

  const day = localCalendarDayFromIso(row.createdAt);
  if (filters.fromDate?.trim() && day && day < filters.fromDate.trim()) return false;
  if (filters.toDate?.trim() && day && day > filters.toDate.trim()) return false;

  return true;
}

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

/**
 * GET livestock restock/deduct history with JSON body (axios — `fetch` cannot attach a body to GET).
 */
export async function getLivestockInventoryHistory(
  filters: LivestockInventoryHistoryFilters
): Promise<
  { ok: true; data: LivestockInventoryHistoryEntry[] } | { ok: false; error: string; status: number }
> {
  const url = `${getBaseUrl()}${PRODUCT_ROUTES.LIVESTOCK_INVENTORY_HISTORY}`;
  const body = buildRequestBody(filters);

  const requestWithToken = (token: string | null) =>
    axios.get<LivestockInventoryHistoryApiResponse>(url, {
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
        .filter((x): x is LivestockInventoryHistoryEntry => x !== null)
        .filter((row) => matchesFilters(row, filters))
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

/** Display amount: prefer row quantity; fall back to legacy weight-only rows. */
export function formatLivestockHistoryAmount(row: LivestockInventoryHistoryEntry): {
  display: string;
  /** When true, the number is from `weight` (legacy); otherwise from `quantity`. */
  isLegacyWeight: boolean;
} {
  const q = row.quantity;
  if (q != null && Number.isFinite(q)) {
    return { display: String(q), isLegacyWeight: false };
  }
  const w = row.weight;
  if (w != null && Number.isFinite(w)) {
    return { display: String(w), isLegacyWeight: true };
  }
  return { display: "\u2014", isLegacyWeight: false };
}
