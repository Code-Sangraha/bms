import axios from "axios";
import { getBaseUrl, tryRefresh } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

export type LivestockInventoryHistoryType = "RESTOCK" | "DEDUCT";

export type LivestockInventoryHistoryFilters = {
  livestockItemId?: string;
  type?: LivestockInventoryHistoryType;
  fromDate?: string;
  toDate?: string;
};

export type LivestockInventoryHistoryItemSnapshot = {
  name: string;
  weight: number;
  quantity: number;
  isBulk: boolean;
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
    return { name: "—", weight: 0, quantity: 0, isBulk: false };
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  return {
    name: name || "—",
    weight: parseNum(o.weight) ?? 0,
    quantity: parseNum(o.quantity) ?? 0,
    isBulk: o.isBulk === true,
  };
}

function parseHistoryType(raw: unknown): LivestockInventoryHistoryType | null {
  if (raw === "RESTOCK" || raw === "DEDUCT") return raw;
  if (typeof raw === "string") {
    const u = raw.toUpperCase();
    if (u === "RESTOCK" || u === "DEDUCT") return u;
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
  const livestockItemId =
    typeof row.livestockItemId === "string"
      ? row.livestockItemId
      : typeof (row as { livestock_item_id?: unknown }).livestock_item_id === "string"
        ? String((row as { livestock_item_id: string }).livestock_item_id)
        : "";
  const nested = row.livestockItem;
  const livestockItem =
    nested && typeof nested === "object"
      ? parseItemSnapshot(nested)
      : {
          name: typeof row.name === "string" ? row.name : "—",
          weight: parseNum(row.weight) ?? 0,
          quantity: parseNum(row.quantity) ?? 0,
          isBulk: row.isBulk === true,
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
    livestockItemId: livestockItemId || id,
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
  if (filters.type === "RESTOCK" || filters.type === "DEDUCT") body.type = filters.type;
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

function errorMessageFromPayload(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const msg = o.message ?? o.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return "Request failed.";
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
      list.map((row, i) => parseEntry(row, i)).filter((x): x is LivestockInventoryHistoryEntry => x !== null)
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

/** Display amount for a history row: head count when bulk, kg when not. */
export function formatLivestockHistoryAmount(row: LivestockInventoryHistoryEntry): {
  display: string;
  isBulk: boolean;
} {
  const bulk = row.livestockItem.isBulk === true;
  if (bulk) {
    const q = row.quantity;
    if (q != null && Number.isFinite(q)) return { display: String(q), isBulk: true };
    return { display: "\u2014", isBulk: true };
  }
  const w = row.weight;
  if (w != null && Number.isFinite(w)) return { display: String(w), isBulk: false };
  return { display: "\u2014", isBulk: false };
}
