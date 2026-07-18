import axios from "axios";
import { getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

/** Backend `ProcessedInventoryHistory`: RESTOCK, DEDUCT, SALE. */
export type ProcessedInventoryHistoryType = "RESTOCK" | "DEDUCT" | "SALE";

export type ProcessedInventoryHistoryFilters = {
  productId?: string;
  type?: ProcessedInventoryHistoryType;
  fromDate?: string;
  toDate?: string;
};

export type ProcessedInventoryHistoryEntry = {
  id: string;
  productId: string;
  product: {
    name: string;
    weight: number | null;
    DualPricing: unknown[];
  } | null;
  quantity: number | null;
  weight: number | null;
  type: ProcessedInventoryHistoryType;
  createdAt: string;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
  batchId?: string | null;
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
  if (raw === "RESTOCK" || raw === "DEDUCT" || raw === "SALE") return raw;
  if (typeof raw === "string") {
    const u = raw.toUpperCase();
    if (u === "RESTOCK" || u === "DEDUCT" || u === "SALE") return u;
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
  const product =
    nestedRecord && typeof nestedRecord.name === "string"
      ? {
          name: nestedRecord.name,
          weight: parseNum(nestedRecord.weight),
          DualPricing: Array.isArray(nestedRecord.DualPricing) ? nestedRecord.DualPricing : [],
        }
      : null;
  const buyingPrice =
    parseNum(row.buyingPrice) ?? parseNum((row as { buying_price?: unknown }).buying_price);
  const sellingPrice =
    parseNum(row.sellingPrice) ?? parseNum((row as { selling_price?: unknown }).selling_price);
  const batchIdRaw = row.batchId ?? row.batch_id;
  const batchId =
    typeof batchIdRaw === "string" && batchIdRaw.trim() ? batchIdRaw.trim() : null;
  return {
    id,
    productId,
    product,
    quantity,
    weight,
    type,
    createdAt,
    buyingPrice: buyingPrice ?? null,
    sellingPrice: sellingPrice ?? null,
    batchId,
  };
}

function buildRequestBody(filters: ProcessedInventoryHistoryFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (filters.productId?.trim()) body.productId = filters.productId.trim();
  if (
    filters.type === "RESTOCK" ||
    filters.type === "DEDUCT" ||
    filters.type === "SALE"
  ) {
    body.type = filters.type;
  }
  if (filters.fromDate?.trim()) body.fromDate = filters.fromDate.trim();
  if (filters.toDate?.trim()) body.toDate = filters.toDate.trim();
  return body;
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

function matchesFilters(
  row: ProcessedInventoryHistoryEntry,
  filters: ProcessedInventoryHistoryFilters
): boolean {
  const productId = filters.productId?.trim();
  if (productId && row.productId !== productId) return false;

  if (filters.type && row.type !== filters.type) return false;

  const day = localCalendarDayFromIso(row.createdAt);
  if (filters.fromDate?.trim() && day && day < filters.fromDate.trim()) return false;
  if (filters.toDate?.trim() && day && day > filters.toDate.trim()) return false;

  return true;
}

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

/** Prefer weight (kg), then quantity — absolute value for movement magnitude. */
export function processedHistoryMovementAmount(entry: ProcessedInventoryHistoryEntry): number {
  const w = entry.weight;
  if (w != null && Number.isFinite(w)) return Math.abs(w);
  const q = entry.quantity;
  if (q != null && Number.isFinite(q)) return Math.abs(q);
  return 0;
}

/**
 * Key used to pair SALE + DEDUCT rows emitted for the same sale line (same weight, same second).
 */
export function saleMirrorKeyForProcessedHistory(entry: ProcessedInventoryHistoryEntry): string {
  const t = Date.parse(entry.createdAt);
  const sec = Number.isFinite(t) ? Math.floor(t / 1000) : 0;
  const amt = processedHistoryMovementAmount(entry);
  return `${entry.productId}|${sec}|${amt}`;
}

export function buildProcessedSaleMirrorKeySet(
  history: readonly ProcessedInventoryHistoryEntry[]
): ReadonlySet<string> {
  const s = new Set<string>();
  for (const e of history) {
    if (e.type === "SALE") s.add(saleMirrorKeyForProcessedHistory(e));
  }
  return s;
}

/** True when this DEDUCT row is the stock leg of a sale (mirror of a SALE row). */
export function isProcessedDeductMirroredBySale(
  entry: ProcessedInventoryHistoryEntry,
  saleMirrorKeys: ReadonlySet<string>
): boolean {
  return entry.type === "DEDUCT" && saleMirrorKeys.has(saleMirrorKeyForProcessedHistory(entry));
}

/**
 * Consumption credited from history without double-counting SALE + mirror DEDUCT.
 * Use SALE for sale-driven outflow; use DEDUCT only when not paired to a SALE.
 */
export function processedHistoryConsumedAmountForLedger(
  entry: ProcessedInventoryHistoryEntry,
  saleMirrorKeys: ReadonlySet<string>
): number {
  if (entry.type === "SALE") return processedHistoryMovementAmount(entry);
  if (entry.type === "DEDUCT" && !isProcessedDeductMirroredBySale(entry, saleMirrorKeys)) {
    return processedHistoryMovementAmount(entry);
  }
  return 0;
}

/**
 * GET `/v1/products/processed/history` with JSON body (axios — `fetch` cannot attach a body to GET).
 * Backend reads `req.body`: productId, optional type, optional fromDate / toDate.
 */
export async function getProcessedInventoryHistory(
  filters: ProcessedInventoryHistoryFilters
): Promise<
  { ok: true; data: ProcessedInventoryHistoryEntry[] } | { ok: false; error: string; status: number }
> {
  const url = `${getBaseUrl()}${PRODUCT_ROUTES.PROCESSED_INVENTORY_HISTORY}`;
  const body = buildRequestBody(filters);

  const requestWithToken = (token: string | null) =>
    axios.get<ProcessedInventoryHistoryApiResponse>(url, {
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

    if (res.status === 404 || res.status === 405) {
      return { ok: true, data: [] };
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
      list
        .map((row, i) => parseEntry(row, i))
        .filter((x): x is ProcessedInventoryHistoryEntry => x !== null)
        .filter((row) => matchesFilters(row, filters))
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
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
