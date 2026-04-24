import { apiRequest } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";

export type ProcessedInventoryHistoryType = "RESTOCK" | "DEDUCT";

export type ProcessedInventoryHistoryFilters = {
  productId?: string;
  type?: ProcessedInventoryHistoryType;
  fromDate?: string;
  toDate?: string;
};

export type ProcessedInventoryHistoryEntry = {
  id: string;
  productId: string;
  quantity: number | null;
  weight: number | null;
  type: ProcessedInventoryHistoryType;
  createdAt: string;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
};

type ProcessedInventoryHistoryApiResponse = {
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

function parseHistoryType(raw: unknown): ProcessedInventoryHistoryType | null {
  if (raw === "RESTOCK" || raw === "DEDUCT") return raw;
  if (typeof raw === "string") {
    const u = raw.toUpperCase();
    if (u === "RESTOCK" || u === "DEDUCT") return u;
  }
  return null;
}

function parseEntry(raw: unknown, index: number): ProcessedInventoryHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    typeof row.id === "string"
      ? row.id
      : typeof row._id === "string"
        ? row._id
        : `processed-history-${index}`;
  const nested = row.product;
  const nestedRecord = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
  const fromNested =
    nestedRecord && typeof nestedRecord.id === "string" && nestedRecord.id.trim()
      ? nestedRecord.id.trim()
      : nestedRecord && typeof nestedRecord._id === "string" && nestedRecord._id.trim()
        ? nestedRecord._id.trim()
        : "";
  const fromRow =
    typeof row.productId === "string" && row.productId.trim()
      ? row.productId.trim()
      : typeof (row as { product_id?: unknown }).product_id === "string"
        ? String((row as { product_id: string }).product_id).trim()
        : "";
  const productId = fromRow || fromNested;
  const type = parseHistoryType(row.type);
  const createdAtRaw = row.createdAt ?? row.created_at;
  const createdAt =
    typeof createdAtRaw === "string"
      ? createdAtRaw
      : createdAtRaw instanceof Date
        ? createdAtRaw.toISOString()
        : "";
  if (!createdAt || !productId || !type) return null;
  const quantity = row.quantity === null ? null : parseNum(row.quantity);
  const weight = row.weight === null ? null : parseNum(row.weight);
  const buyingPrice =
    parseNum(row.buyingPrice) ?? parseNum((row as { buying_price?: unknown }).buying_price);
  const sellingPrice =
    parseNum(row.sellingPrice) ?? parseNum((row as { selling_price?: unknown }).selling_price);
  return {
    id,
    productId,
    quantity,
    weight,
    type,
    createdAt,
    buyingPrice: buyingPrice ?? null,
    sellingPrice: sellingPrice ?? null,
  };
}

function buildQueryString(filters: ProcessedInventoryHistoryFilters): string {
  const sp = new URLSearchParams();
  if (filters.productId?.trim()) sp.set("productId", filters.productId.trim());
  if (filters.type === "RESTOCK" || filters.type === "DEDUCT") sp.set("type", filters.type);
  if (filters.fromDate?.trim()) sp.set("fromDate", filters.fromDate.trim());
  if (filters.toDate?.trim()) sp.set("toDate", filters.toDate.trim());
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function extractList(payload: ProcessedInventoryHistoryApiResponse): unknown[] {
  const nested = payload?.data;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === "object" && Array.isArray((nested as { items?: unknown[] }).items)) {
    return (nested as { items: unknown[] }).items;
  }
  if (Array.isArray(payload?.items)) return payload.items as unknown[];
  return [];
}

function sortByCreatedAtDesc(rows: ProcessedInventoryHistoryEntry[]): ProcessedInventoryHistoryEntry[] {
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
 * GET processed restock/deduct history with **query** params (no GET body).
 * Per inventory-feature.md: prefer query or POST for date-filtered movement.
 */
export async function getProcessedInventoryHistory(
  filters: ProcessedInventoryHistoryFilters
): Promise<
  { ok: true; data: ProcessedInventoryHistoryEntry[] } | { ok: false; error: string; status: number }
> {
  const qs = buildQueryString(filters);
  const result = await apiRequest<ProcessedInventoryHistoryApiResponse>(
    `${PRODUCT_ROUTES.PROCESSED_INVENTORY_HISTORY}${qs}`,
    { method: "GET" }
  );

  if (!result.ok) {
    if (result.status === 404 || result.status === 405) {
      return { ok: true, data: [] };
    }
    return result;
  }

  const payload = result.data ?? {};
  if (payload.success === false) {
    return {
      ok: false,
      error: errorMessageFromPayload(payload),
      status: 200,
    };
  }

  const list = extractList(payload);
  const data = sortByCreatedAtDesc(
    list.map((row, i) => parseEntry(row, i)).filter((x): x is ProcessedInventoryHistoryEntry => x !== null)
  );
  return { ok: true, data };
}

/** Display amount for processed rows: prefer weight (kg), then quantity. */
export function formatProcessedHistoryAmount(row: ProcessedInventoryHistoryEntry): {
  display: string;
  isWeight: boolean;
} {
  const w = row.weight;
  if (w != null && Number.isFinite(w)) {
    return { display: String(w), isWeight: true };
  }
  const q = row.quantity;
  if (q != null && Number.isFinite(q)) {
    return { display: String(q), isWeight: false };
  }
  return { display: "\u2014", isWeight: false };
}
