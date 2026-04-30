import type {
  OpeningStockByDate,
  OpeningStockData,
  OpeningStockItem,
  Product,
} from "@/handlers/product";
import type { ProcessedInventoryHistoryEntry } from "@/lib/api/processedInventoryHistory";
import {
  buildProcessedSaleMirrorKeySet,
  processedHistoryConsumedAmountForLedger,
  processedHistoryMovementAmount,
} from "@/lib/api/processedInventoryHistory";
import {
  compareIsoDates,
  enumerateLocalDaysInclusive,
} from "@/app/dashboard/product/liveProduct/lib/buildLivestockOpeningStockData";
import { getProcessedStockWeight } from "./processedStockWeight";

export type ProcessedClientStockMode = "reconciled" | "movementOnly";

function localCalendarDateFromTimestamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    const s = iso.trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Prefer weight (kg) for processed movement; fall back to quantity. */
export function processedHistoryEntryAmount(entry: ProcessedInventoryHistoryEntry): number {
  return processedHistoryMovementAmount(entry);
}

function stableProductKey(product: Product): string {
  return product.id.trim();
}

function candidateKeysForProduct(product: Product): string[] {
  const id = product.id?.trim();
  return id ? [id] : [];
}

function canonicalKeyForHistoryProductId(historyPid: string, products: Product[]): string | null {
  const hk = historyPid.trim();
  if (!hk) return null;
  for (const p of products) {
    const canonical = stableProductKey(p);
    for (const c of candidateKeysForProduct(p)) {
      if (c === hk) return canonical;
    }
  }
  return null;
}

function productNumberForRow(product: Product): string {
  const code = (product as { itemCode?: unknown }).itemCode;
  if (typeof code === "string" && code.trim()) return code.trim();
  const bc = (product as { barcode?: unknown }).barcode;
  if (typeof bc === "string" && bc.trim()) return bc.trim();
  return "";
}

export type BuildProcessedOpeningStockParams = {
  from: string;
  to: string;
  products: Product[];
  history: ProcessedInventoryHistoryEntry[];
  mode: ProcessedClientStockMode;
};

/**
 * Builds `OpeningStockData` for processed products from restock/deduct history and current stock weight.
 * When `mode === "reconciled"`, use only when the selected end date is **today** (local); closing on the last day
 * anchors from current `weight` minus history strictly after `to`.
 */
export function buildProcessedOpeningStockData(params: BuildProcessedOpeningStockParams): OpeningStockData {
  const { from, to, products, history, mode } = params;
  if (products.length === 0) {
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
  const productKeys = new Set(products.flatMap((p) => candidateKeysForProduct(p)));

  const bucket = new Map<string, Map<string, { added: number; consumed: number }>>();
  const saleMirrorKeys = buildProcessedSaleMirrorKeySet(history);

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
    const rawPid = entry.productId?.trim() || "";
    if (!rawPid || !productKeys.has(rawPid)) continue;
    const canonical = canonicalKeyForHistoryProductId(rawPid, products);
    if (!canonical) continue;

    const day = localCalendarDateFromTimestamp(entry.createdAt);
    if (compareIsoDates(day, from) < 0 || compareIsoDates(day, to) > 0) continue;

    const cell = ensureBucket(canonical, day);
    if (entry.type === "RESTOCK" || entry.type === "IN") {
      cell.added += processedHistoryEntryAmount(entry);
    } else {
      cell.consumed += processedHistoryConsumedAmountForLedger(entry, saleMirrorKeys);
    }
  }

  function netHistoryAfterTo(canonicalKey: string): number {
    let restock = 0;
    let deduct = 0;
    for (const entry of history) {
      const rawPid = entry.productId?.trim() || "";
      const canonical = canonicalKeyForHistoryProductId(rawPid, products);
      if (canonical !== canonicalKey) continue;
      const day = localCalendarDateFromTimestamp(entry.createdAt);
      if (compareIsoDates(day, to) <= 0) continue;
      const addedAmt =
        entry.type === "RESTOCK" || entry.type === "IN" ? processedHistoryEntryAmount(entry) : 0;
      const consumedAmt = processedHistoryConsumedAmountForLedger(entry, saleMirrorKeys);
      restock += addedAmt;
      deduct += consumedAmt;
    }
    return restock - deduct;
  }

  type ItemDayLedger = { opening: number; closing: number; added: number; consumed: number };

  function ledgerByDayForProduct(product: Product, key: string): Map<string, ItemDayLedger> {
    const map = new Map<string, ItemDayLedger>();
    if (days.length === 0) return map;

    const wNow = getProcessedStockWeight(product);
    let closingEnd = wNow - netHistoryAfterTo(key);

    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      const c = bucket.get(key)?.get(d) ?? { added: 0, consumed: 0 };
      const openingStart = closingEnd - c.added + c.consumed;
      map.set(d, { opening: openingStart, closing: closingEnd, added: c.added, consumed: c.consumed });
      closingEnd = openingStart;
    }
    return map;
  }

  const perProductLedger = new Map<string, Map<string, ItemDayLedger>>();
  if (mode === "reconciled") {
    for (const p of products) {
      const key = stableProductKey(p);
      perProductLedger.set(key, ledgerByDayForProduct(p, key));
    }
  }

  const openingStockByDate: OpeningStockByDate[] = [];

  for (const day of days) {
    const rowItems: OpeningStockItem[] = [];

    for (const p of products) {
      const key = stableProductKey(p);
      const cell = bucket.get(key)?.get(day) ?? { added: 0, consumed: 0 };
      const added = cell.added;
      const consumed = cell.consumed;

      let openingQuantity: number | null;
      let closingQuantity: number | null;

      if (mode === "movementOnly") {
        openingQuantity = null;
        closingQuantity = null;
      } else {
        const led = perProductLedger.get(key)?.get(day);
        openingQuantity = led?.opening ?? null;
        closingQuantity = led?.closing ?? null;
      }

      rowItems.push({
        inventoryId: p.id,
        productName: p.name.trim() || "—",
        productNumber: productNumberForRow(p),
        unit: "kg",
        openingQuantity,
        addedQuantity: added,
        consumedQuantity: consumed,
        closingQuantity,
        buyingPrice: undefined,
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

  const totalRecords = openingStockByDate.reduce((s, d) => s + d.items.length, 0);

  return {
    from,
    to,
    totalQuantity: openingStockByDate.reduce((s, d) => s + d.totalAdded + d.totalConsumed, 0),
    totalPrice: 0,
    totalRecords,
    openingStockByDate,
  };
}
