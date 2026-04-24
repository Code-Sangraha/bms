import type {
  LivestockCategory,
  LivestockItem,
  OpeningStockByDate,
  OpeningStockData,
  OpeningStockItem,
} from "@/handlers/product";
import { resolveLivestockItemId } from "@/handlers/product";
import type { LivestockInventoryHistoryEntry } from "@/lib/api/livestockInventoryHistory";

export type LivestockClientStockMode = "reconciled" | "movementOnly";

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

/** Compare YYYY-MM-DD strings by calendar order (local-safe for same format). */
export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Inclusive list of local calendar days from `from` through `to` (YYYY-MM-DD). */
export function enumerateLocalDaysInclusive(fromIso: string, toIso: string): string[] {
  const start = parseIsoDate(fromIso);
  const end = parseIsoDate(toIso);
  if (!start || !end) return [];
  if (compareIsoDates(fromIso, toIso) > 0) return [];

  const out: string[] = [];
  const cur = new Date(start.y, start.m - 1, start.d);
  const endDate = new Date(end.y, end.m - 1, end.d);
  while (cur <= endDate) {
    out.push(toIsoDateLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function localCalendarDateFromTimestamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    const s = iso.trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  return toIsoDateLocal(new Date(t));
}

/** Same numeric preference as `formatLivestockHistoryAmount`: quantity, else weight. */
export function historyEntryAmount(entry: LivestockInventoryHistoryEntry): number {
  const q = entry.quantity;
  if (q != null && Number.isFinite(q)) return Math.abs(q);
  const w = entry.weight;
  if (w != null && Number.isFinite(w)) return Math.abs(w);
  return 0;
}

export function currentLivestockQuantity(item: LivestockItem): number {
  const q = item.quantity;
  if (typeof q === "number" && Number.isFinite(q)) return q;
  const iow = item.itemQuantityOrWeight;
  if (typeof iow === "number" && Number.isFinite(iow)) return iow;
  if (typeof item.weight === "number" && Number.isFinite(item.weight)) return item.weight;
  return 0;
}

function stableItemKey(item: LivestockItem): string {
  return resolveLivestockItemId(item) ?? `${item.productId}:${item.itemId}`;
}

/** Any id the backend might put on history rows for this inventory line. */
function candidateKeysForItem(item: LivestockItem): string[] {
  const out: string[] = [];
  const resolved = resolveLivestockItemId(item)?.trim();
  if (resolved) out.push(resolved);
  const iid = typeof item.itemId === "string" ? item.itemId.trim() : "";
  if (iid) out.push(iid);
  const composite = `${item.productId}:${iid}`;
  if (iid) out.push(composite);
  return [...new Set(out.filter(Boolean))];
}

/** Map a history row's livestockItemId (any alias) to the canonical key used in buckets / ledger. */
function canonicalKeyForHistoryId(historyKey: string, items: LivestockItem[]): string | null {
  const hk = historyKey.trim();
  if (!hk) return null;
  for (const item of items) {
    const canonical = stableItemKey(item);
    for (const c of candidateKeysForItem(item)) {
      if (c === hk) return canonical;
    }
  }
  return null;
}

function productDisplayName(item: LivestockItem, categories: LivestockCategory[]): string {
  const cat = categories.find((c) => c.id === item.productId)?.name?.trim();
  const name = (item.name ?? "").trim() || "—";
  if (cat) return `${cat} — ${name}`;
  return name;
}

export type BuildLivestockOpeningStockParams = {
  from: string;
  to: string;
  items: LivestockItem[];
  history: LivestockInventoryHistoryEntry[];
  categories: LivestockCategory[];
  mode: LivestockClientStockMode;
};

/**
 * Builds `OpeningStockData` for livestock from manual history (RESTOCK/DEDUCT) and current quantities.
 * When `mode === "reconciled"`, the caller should only use this when the selected end date is **today** (local);
 * closing on the last day is anchored from current stock minus history strictly after `to`.
 * Send-to-processing is not in this history — numbers may drift.
 */
export function buildLivestockOpeningStockData(params: BuildLivestockOpeningStockParams): OpeningStockData {
  const { from, to, items, history, categories, mode } = params;
  if (items.length === 0) {
    return {
      from,
      to,
      totalQuantity: 0,
      totalPrice: 0,
      totalRecords: 0,
      openingStockByDate: [],
    };
  }

  const days = enumerateLocalDaysInclusive(from, to);
  const itemKeys = new Set(items.flatMap((it) => candidateKeysForItem(it)));

  /** itemKey -> date -> { added, consumed } for days in [from, to] */
  const bucket = new Map<string, Map<string, { added: number; consumed: number }>>();

  function ensureBucket(key: string, date: string): { added: number; consumed: number } {
    let byDate = bucket.get(key);
    if (!byDate) {
      byDate = new Map();
      bucket.set(key, byDate);
    }
    let cell = byDate.get(date);
    if (!cell) {
      cell = { added: 0, consumed: 0 };
      byDate.set(date, cell);
    }
    return cell;
  }

  for (const entry of history) {
    const rawKey = entry.livestockItemId?.trim() || "";
    if (!rawKey || !itemKeys.has(rawKey)) continue;
    const canonical = canonicalKeyForHistoryId(rawKey, items);
    if (!canonical) continue;

    const day = localCalendarDateFromTimestamp(entry.createdAt);
    if (compareIsoDates(day, from) < 0 || compareIsoDates(day, to) > 0) continue;

    const amt = historyEntryAmount(entry);
    const cell = ensureBucket(canonical, day);
    if (entry.type === "RESTOCK") cell.added += amt;
    else cell.consumed += amt;
  }

  /** Net (restock − deduct) for entries strictly after calendar day `to` (for anchor). */
  function netHistoryAfterTo(canonicalItemKey: string): number {
    let restock = 0;
    let deduct = 0;
    for (const entry of history) {
      const rawKey = entry.livestockItemId?.trim() || "";
      const canonical = canonicalKeyForHistoryId(rawKey, items);
      if (canonical !== canonicalItemKey) continue;
      const day = localCalendarDateFromTimestamp(entry.createdAt);
      if (compareIsoDates(day, to) <= 0) continue;
      const amt = historyEntryAmount(entry);
      if (entry.type === "RESTOCK") restock += amt;
      else deduct += amt;
    }
    return restock - deduct;
  }

  type ItemDayLedger = { opening: number; closing: number; added: number; consumed: number };

  /** One backward pass per item: end-of-day closing on `to` anchored from current qty, then walk back. */
  function ledgerByDayForItem(item: LivestockItem, itemKey: string): Map<string, ItemDayLedger> {
    const map = new Map<string, ItemDayLedger>();
    if (days.length === 0) return map;

    const qNow = currentLivestockQuantity(item);
    let closingEnd = qNow - netHistoryAfterTo(itemKey);

    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      const c = bucket.get(itemKey)?.get(d) ?? { added: 0, consumed: 0 };
      const openingStart = closingEnd - c.added + c.consumed;
      map.set(d, { opening: openingStart, closing: closingEnd, added: c.added, consumed: c.consumed });
      closingEnd = openingStart;
    }
    return map;
  }

  const perItemLedger = new Map<string, Map<string, ItemDayLedger>>();
  if (mode === "reconciled") {
    for (const item of items) {
      const itemKey = stableItemKey(item);
      perItemLedger.set(itemKey, ledgerByDayForItem(item, itemKey));
    }
  }

  const openingStockByDate: OpeningStockByDate[] = [];

  for (const day of days) {
    const rowItems: OpeningStockItem[] = [];

    for (const item of items) {
      const itemKey = stableItemKey(item);
      const cell = bucket.get(itemKey)?.get(day) ?? { added: 0, consumed: 0 };
      const added = cell.added;
      const consumed = cell.consumed;

      let openingQuantity: number | null;
      let closingQuantity: number | null;

      if (mode === "movementOnly") {
        openingQuantity = null;
        closingQuantity = null;
      } else {
        const led = perItemLedger.get(itemKey)?.get(day);
        openingQuantity = led?.opening ?? null;
        closingQuantity = led?.closing ?? null;
      }

      const invId = resolveLivestockItemId(item) ?? itemKey;
      rowItems.push({
        inventoryId: invId,
        productName: productDisplayName(item, categories),
        productNumber: item.itemId ?? "",
        unit: "",
        openingQuantity,
        addedQuantity: added,
        consumedQuantity: consumed,
        closingQuantity,
        buyingPrice: item.buyingPrice ?? undefined,
        totalPrice: undefined,
      });
    }

    let totalOpening: number | null = null;
    let totalClosing: number | null = null;
    if (mode === "reconciled") {
      totalOpening = rowItems.reduce((s, r) => s + (r.openingQuantity ?? 0), 0);
      totalClosing = rowItems.reduce((s, r) => s + (r.closingQuantity ?? 0), 0);
    }
    const totalAdded = rowItems.reduce((s, r) => s + r.addedQuantity, 0);
    const totalConsumed = rowItems.reduce((s, r) => s + r.consumedQuantity, 0);

    openingStockByDate.push({
      date: day,
      totalOpening,
      totalAdded,
      totalConsumed,
      totalClosing,
      items: rowItems,
    });
  }

  const lastDay = days[days.length - 1];
  const lastRows = openingStockByDate.find((d) => d.date === lastDay)?.items ?? [];
  const totalQuantity =
    mode === "reconciled" ? lastRows.reduce((s, r) => s + (r.closingQuantity ?? 0), 0) : 0;
  const totalRecords = openingStockByDate.reduce((s, d) => s + d.items.length, 0);

  return {
    from,
    to,
    totalQuantity,
    totalPrice: 0,
    totalRecords,
    openingStockByDate,
  };
}
