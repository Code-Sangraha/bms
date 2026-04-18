import type { CreateProductFormValues } from "@/schema/product";
import { apiRequest } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";
import {
  formatLivestockHistoryAmount,
  getLivestockInventoryHistory as requestLivestockInventoryHistory,
  type LivestockInventoryHistoryEntry,
} from "@/lib/api/livestockInventoryHistory";

export type Product = {
  id: string;
  name: string;
  productTypeId: string;
  outletId: string;
  quantity: number;
  status: boolean;
  createdBy?: string;
  productType?: { id?: string; name?: string };
  outlet?: { id?: string; name?: string };
  weight?: number | null;
  stockStatus?: string;
  [key: string]: unknown;
};

export type GetProductsResponse = {
  data?: Product[];
  products?: Product[];
  [key: string]: unknown;
};

export type CreateProductPayload = {
  name: string;
  productTypeId: string;
  outletId: string;
  quantity?: number;
  weight?: number;
  status: boolean;
  createdBy?: string;
};

export type CreateProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type UpdateProductPayload = {
  id: string;
  name: string;
  productTypeId: string;
  outletId: string;
  quantity?: number;
  weight?: number;
  status: boolean;
  createdBy?: string;
};

export type UpdateProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DeleteProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

/**
 * Backend may return HTTP 2xx (e.g. 201) with `{ success: false, message }` for failed deletes.
 * Treat that as failure regardless of status code.
 */
function normalizeProductDeleteApiResult<T extends DeleteProductResponse>(
  result: { ok: true; data: T } | { ok: false; error: string; status: number }
): { ok: true; data: T } | { ok: false; error: string; status: number } {
  if (!result.ok) return result;
  if (result.data.success === false) {
    const msg =
      typeof result.data.message === "string" && result.data.message.trim()
        ? result.data.message.trim()
        : "Delete failed.";
    return { ok: false, error: msg, status: 200 };
  }
  return result;
}

export async function getProducts(): Promise<
  | { ok: true; data: Product[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetProductsResponse>(PRODUCT_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.products ?? [];
  const parseNum = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  const data: Product[] = Array.isArray(list)
    ? list.map((item) => {
        const asRecord = item as Record<string, unknown>;
        const quantityFromAny =
          parseNum(asRecord.quantity) ??
          parseNum(asRecord.itemQuantityOrWeight) ??
          parseNum(asRecord.stockQuantity) ??
          parseNum(asRecord.availableQuantity) ??
          parseNum(asRecord.currentQuantity) ??
          0;
        const weightFromAny =
          parseNum(asRecord.weight) ??
          parseNum(asRecord.itemQuantityOrWeight) ??
          parseNum(asRecord.stockWeight) ??
          parseNum(asRecord.availableWeight) ??
          parseNum(asRecord.currentWeight) ??
          parseNum(asRecord.outputWeight) ??
          parseNum(asRecord.totalWeight) ??
          quantityFromAny;
        return {
          ...item,
          quantity: quantityFromAny,
          weight: weightFromAny,
        } as Product;
      })
    : [];
  return { ok: true, data };
}

export async function createProduct(
  payload: CreateProductFormValues,
  options?: { isProcessed?: boolean }
) {
  const body: CreateProductPayload = {
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    status: payload.status === "Active",
  };
  if (!options?.isProcessed) {
    body.quantity = Number(payload.quantity);
  }
  if (payload.createdBy?.trim()) body.createdBy = payload.createdBy.trim();
  return apiRequest<CreateProductResponse>(PRODUCT_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  id: string,
  payload: CreateProductFormValues,
  options?: { isProcessed?: boolean }
) {
  const body: UpdateProductPayload = {
    id,
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    status: payload.status === "Active",
  };
  if (options?.isProcessed) {
    body.weight = Number(payload.quantity);
    body.quantity = Number(payload.quantity);
  }
  else body.quantity = Number(payload.quantity);
  if (payload.createdBy?.trim()) body.createdBy = payload.createdBy.trim();
  return apiRequest<UpdateProductResponse>(PRODUCT_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id: string) {
  return normalizeProductDeleteApiResult(
    await apiRequest<DeleteProductResponse>(PRODUCT_ROUTES.DELETE, {
      method: "DELETE",
      body: JSON.stringify({ id }),
    })
  );
}

export type RestockProductPayload = {
  id: string;
  outletId: string;
  /** Restock by weight only (e.g. transfers). Omit when using `quantity`. */
  weight?: number;
  /** Restock quantity only; does not adjust product weight. */
  quantity?: number;
};

export type DeductProductPayload = {
  id: string;
  /** Deduct by weight only. Omit when using `quantity`. */
  weight?: number;
  /** Deduct quantity only; does not adjust product weight. */
  quantity?: number;
};

export type RestockDeductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function restockProduct(payload: RestockProductPayload) {
  const body: Record<string, unknown> = {
    id: payload.id,
    outletId: payload.outletId,
  };
  if (payload.quantity != null) {
    body.quantity = Number(payload.quantity);
  } else if (payload.weight != null) {
    body.weight = Number(payload.weight);
  } else {
    return {
      ok: false as const,
      error: "Restock requires quantity or weight.",
      status: 400,
    };
  }
  return apiRequest<RestockDeductResponse>(PRODUCT_ROUTES.RESTOCK, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deductProduct(payload: DeductProductPayload) {
  const body: Record<string, unknown> = { id: payload.id };
  if (payload.quantity != null) {
    body.quantity = Number(payload.quantity);
  } else if (payload.weight != null) {
    body.weight = Number(payload.weight);
  } else {
    return {
      ok: false as const,
      error: "Deduct requires quantity or weight.",
      status: 400,
    };
  }
  return apiRequest<RestockDeductResponse>(PRODUCT_ROUTES.DEDUCT, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type CreateLivestockItemPayload = {
  productId: string;
  name: string;
  itemId: string;
  /** Initial stock amount — backend `createLiveStockProductItem` reads this (not `itemQuantityOrWeight`). */
  quantity: number;
  buyingPrice: number | null;
  sellingPrice: number | null;
  status: boolean;
};

export type LivestockItem = {
  id?: string;
  productId: string;
  name: string;
  itemId: string;
  /** Stock / legacy scalar used by restock and older APIs (may mirror quantity or weight). */
  weight: number;
  /** Head count or unit quantity from the API — never derived from body `weight` (kg). */
  quantity?: number | null;
  itemQuantityOrWeight?: number;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
  status: boolean;
  [key: string]: unknown;
};

/** Resolves stable record id for API calls (id, _id, or livestockItemId). */
export function resolveLivestockItemId(item: LivestockItem): string | null {
  const withUnderscore = item as unknown as { _id?: unknown };
  const withLivestockItemId = item as unknown as { livestockItemId?: unknown };
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof withUnderscore._id === "string" ? withUnderscore._id : null;
  const fromLivestockItemId =
    typeof withLivestockItemId.livestockItemId === "string" ? withLivestockItemId.livestockItemId : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

export type LivestockWasteHistoryEntry = {
  id: string;
  date: string;
  quantity: number;
  remarks: string;
};

type LivestockWasteHistoryApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  items?: unknown;
  [key: string]: unknown;
};

function parseWasteHistoryEntry(raw: unknown, index: number): LivestockWasteHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    typeof row.id === "string"
      ? row.id
      : typeof row._id === "string"
        ? row._id
        : `waste-row-${index}`;
  const dateRaw =
    row.date ??
    row.createdAt ??
    row.updatedAt ??
    (row as { created_at?: unknown }).created_at;
  const date =
    typeof dateRaw === "string"
      ? dateRaw.slice(0, 10)
      : dateRaw instanceof Date
        ? dateRaw.toISOString().slice(0, 10)
        : "";
  const qtyRaw =
    row.quantity ??
    row.consumedQuantity ??
    row.amount ??
    row.itemQuantityOrWeight ??
    row.weight;
  let quantity = 0;
  if (typeof qtyRaw === "number" && Number.isFinite(qtyRaw)) quantity = qtyRaw;
  else if (typeof qtyRaw === "string" && qtyRaw.trim()) {
    const n = Number(qtyRaw);
    if (Number.isFinite(n)) quantity = n;
  }
  const remarks =
    typeof row.remarks === "string"
      ? row.remarks
      : typeof row.note === "string"
        ? row.note
        : typeof row.reason === "string"
          ? row.reason
          : "";
  if (!date && quantity === 0 && !remarks.trim()) return null;
  return { id, date: date || "—", quantity, remarks: remarks.trim() ? remarks : "—" };
}

export type WasteHistoryDateRange = { from?: string; to?: string };

function mapInventoryHistoryToWasteEntry(
  row: LivestockInventoryHistoryEntry
): LivestockWasteHistoryEntry {
  const amt = formatLivestockHistoryAmount(row);
  const parsed = amt.display === "\u2014" ? NaN : Number(amt.display);
  const quantity = Number.isFinite(parsed) ? parsed : 0;
  const date =
    typeof row.createdAt === "string" && row.createdAt.length >= 10
      ? row.createdAt.slice(0, 10)
      : row.createdAt;
  const remarks =
    row.type === "RESTOCK" || row.type === "DEDUCT"
      ? row.type
      : "\u2014";
  return {
    id: row.id,
    date: date || "—",
    quantity,
    remarks,
  };
}

/** Same GET `/products/livestock/history` + JSON body as stock history; maps rows to waste table shape. */
export async function getLivestockWasteHistory(
  livestockItemId: string,
  range?: WasteHistoryDateRange
): Promise<
  { ok: true; data: LivestockWasteHistoryEntry[] } | { ok: false; error: string; status: number }
> {
  const result = await requestLivestockInventoryHistory({
    livestockItemId,
    fromDate: range?.from,
    toDate: range?.to,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapInventoryHistoryToWasteEntry) };
}

export type {
  LivestockInventoryHistoryType,
  LivestockInventoryHistoryFilters,
  LivestockInventoryHistoryEntry,
  LivestockInventoryHistoryItemSnapshot,
} from "@/lib/api/livestockInventoryHistory";
export { getLivestockInventoryHistory, formatLivestockHistoryAmount } from "@/lib/api/livestockInventoryHistory";

export type LivestockCategory = {
  id: string;
  name: string;
};

export type CreateLivestockCategoryPayload = {
  name: string;
};

export type CreateLivestockCategoryResponse = {
  success?: boolean;
  message?: string;
  data?: { id?: string; name?: string; category?: { id?: string; name?: string } };
  category?: { id?: string; name?: string };
  item?: { id?: string; name?: string };
  [key: string]: unknown;
};

export type GetLivestockCategoriesResponse = {
  success?: boolean;
  message?: string;
  data?: Array<{ id?: string; name?: string; status?: boolean }>;
  categories?: Array<{ id?: string; name?: string; status?: boolean }>;
  [key: string]: unknown;
};

type LivestockCategoriesResult =
  | { ok: true; data: LivestockCategory[] }
  | { ok: false; error: string; status: number };

const LIVESTOCK_CATEGORIES_CACHE_MS = 2 * 60 * 1000;
const LIVESTOCK_CATEGORIES_COOLDOWN_MS = 30 * 1000;
let livestockCategoriesCooldownUntil = 0;
let livestockCategoriesInflight: Promise<LivestockCategoriesResult> | null = null;
let livestockCategoriesCache: { data: LivestockCategory[]; expiresAt: number } | null = null;

function parseNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLivestockItem(item: LivestockItem): LivestockItem {
  const parseNum = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const rec = item as Record<string, unknown>;
  const explicitQuantity = parseNum((item as { quantity?: unknown }).quantity);
  const explicitWeight = parseNum(item.weight);
  const iqw = parseNum(item.itemQuantityOrWeight);

  const itemQuantityOrWeightResolved = iqw ?? explicitQuantity ?? explicitWeight ?? 0;
  const weightScalar = explicitWeight ?? iqw ?? explicitQuantity ?? 0;

  const buyingPrice =
    parseNullableNum(rec.buyingPrice) ??
    parseNullableNum(rec.buying_price);
  const sellingPrice =
    parseNullableNum(rec.sellingPrice) ??
    parseNullableNum(rec.selling_price);

  return {
    ...item,
    quantity: explicitQuantity,
    weight: weightScalar,
    itemQuantityOrWeight: itemQuantityOrWeightResolved,
    buyingPrice,
    sellingPrice,
  };
}

export async function createLivestockCategory(payload: CreateLivestockCategoryPayload): Promise<
  | { ok: true; data: LivestockCategory }
  | { ok: false; error: string; status: number }
> {
  const attempts = [
    () =>
      apiRequest<CreateLivestockCategoryResponse>(PRODUCT_ROUTES.LIVESTOCK_CREATE_CATEGORY, {
        method: "POST",
        body: JSON.stringify({ name: payload.name }),
      }),
    () =>
      apiRequest<CreateLivestockCategoryResponse>(PRODUCT_ROUTES.LIVESTOCK_CREATE_CATEGORY, {
        method: "POST",
        body: JSON.stringify({ categoryName: payload.name }),
      }),
    () =>
      apiRequest<CreateLivestockCategoryResponse>(PRODUCT_ROUTES.LIVESTOCK_CREATE_CATEGORY, {
        method: "POST",
        body: JSON.stringify({ title: payload.name }),
      }),
  ];

  let lastError:
    | { ok: false; error: string; status: number }
    | null = null;

  for (const attempt of attempts) {
    const result = await attempt();
    if (!result.ok) {
      lastError = result;
      if (result.status === 500) return result;
      if (result.status && ![400, 404, 405].includes(result.status)) return result;
      continue;
    }

    const raw = result.data;
    const id =
      raw.data?.id ??
      raw.data?.category?.id ??
      raw.category?.id ??
      raw.item?.id;
    const name =
      raw.data?.name ??
      raw.data?.category?.name ??
      raw.category?.name ??
      raw.item?.name ??
      payload.name;
    if (!id || !name) {
      return { ok: false, error: "Could not resolve created livestock category.", status: 500 };
    }
    return { ok: true, data: { id, name } };
  }

  if (lastError?.status === 500) {
    return {
      ok: false,
      status: 500,
      error:
        lastError.error ||
        "Server failed to create livestock category. Please verify backend product-type mapping for livestock.",
    };
  }

  return (
    lastError ?? {
      ok: false,
      status: 400,
      error: "Failed to create livestock category.",
    }
  );
}

export async function getLivestockCategories(): Promise<
  | { ok: true; data: LivestockCategory[] }
  | { ok: false; error: string; status: number }
> {
  const now = Date.now();
  if (livestockCategoriesCache && livestockCategoriesCache.expiresAt > now) {
    return { ok: true, data: livestockCategoriesCache.data };
  }
  if (now < livestockCategoriesCooldownUntil) {
    if (livestockCategoriesCache?.data) return { ok: true, data: livestockCategoriesCache.data };
    return {
      ok: false,
      status: 429,
      error: "Rate limit reached while loading livestock categories. Please retry shortly.",
    };
  }
  if (livestockCategoriesInflight) return livestockCategoriesInflight;

  livestockCategoriesInflight = (async () => {
  const result = await apiRequest<GetLivestockCategoriesResponse>(
    PRODUCT_ROUTES.LIVESTOCK_GET_CATEGORY,
    { method: "GET" }
  );
    if (!result.ok) {
      if (result.status === 429) {
        livestockCategoriesCooldownUntil = Date.now() + LIVESTOCK_CATEGORIES_COOLDOWN_MS;
        if (livestockCategoriesCache?.data) {
          return { ok: true, data: livestockCategoriesCache.data };
        }
      }
      return result;
    }
    const list = result.data?.data ?? result.data?.categories ?? [];
    const normalized: LivestockCategory[] = Array.isArray(list)
      ? list
          .map((item) => ({
            id: item.id ?? "",
            name: item.name ?? "",
          }))
          .filter((item) => item.id && item.name)
      : [];
    livestockCategoriesCache = {
      data: normalized,
      expiresAt: Date.now() + LIVESTOCK_CATEGORIES_CACHE_MS,
    };
    return { ok: true, data: normalized };
  })();

  try {
    return await livestockCategoriesInflight;
  } finally {
    livestockCategoriesInflight = null;
  }
}

export type CreateLivestockItemResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem;
  item?: LivestockItem;
  [key: string]: unknown;
};

export async function createLivestockItem(payload: CreateLivestockItemPayload) {
  const body = {
    productId: payload.productId,
    name: payload.name,
    itemId: payload.itemId,
    quantity: payload.quantity,
    buyingPrice: payload.buyingPrice,
    sellingPrice: payload.sellingPrice,
    status: payload.status,
  };
  return apiRequest<CreateLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_CREATE_ITEM, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type GetLivestockItemsByProductResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem[];
  items?: LivestockItem[];
  [key: string]: unknown;
};

type LivestockItemsResult =
  | { ok: true; data: LivestockItem[] }
  | { ok: false; error: string; status: number };

const LIVESTOCK_ITEMS_CACHE_MS = 2 * 60 * 1000;
const LIVESTOCK_ITEMS_COOLDOWN_MS = 30 * 1000;
const livestockItemsCache = new Map<string, { data: LivestockItem[]; expiresAt: number }>();
const livestockItemsInflight = new Map<string, Promise<LivestockItemsResult>>();
let livestockItemsCooldownUntil = 0;

/** Clears in-memory livestock item lists so the next fetch hits the API (use after restock/deduct/delete). */
export function clearLivestockItemsCache(): void {
  livestockItemsCache.clear();
}

export async function getLivestockItemsByProduct(
  productId: string
): Promise<LivestockItemsResult> {
  const now = Date.now();
  const cached = livestockItemsCache.get(productId);
  if (cached && cached.expiresAt > now) {
    return { ok: true, data: cached.data };
  }

  // Avoid hammering endpoint during backend rate-limit window.
  if (now < livestockItemsCooldownUntil) {
    return { ok: true, data: cached?.data ?? [] };
  }

  const inflight = livestockItemsInflight.get(productId);
  if (inflight) return inflight;

  const requestPromise: Promise<LivestockItemsResult> = (async () => {
    const mapListToRows = (list: unknown[]): LivestockItem[] =>
      list.map((item) => ({
        ...normalizeLivestockItem(item as LivestockItem),
        productId: (item as LivestockItem).productId || productId,
      }));

    const cacheAndReturn = (list: unknown[]) => {
      const data = Array.isArray(list) ? mapListToRows(list) : [];
      livestockItemsCache.set(productId, {
        data,
        expiresAt: Date.now() + LIVESTOCK_ITEMS_CACHE_MS,
      });
      return { ok: true as const, data };
    };

    // 1) GET + query — reliable in browsers/proxies (GET bodies are often stripped).
    const queryGet = await apiRequest<GetLivestockItemsByProductResponse>(
      `${PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT}?productId=${encodeURIComponent(productId)}`,
      { method: "GET" }
    );
    if (queryGet.ok) {
      const list = queryGet.data?.data ?? queryGet.data?.items ?? [];
      return cacheAndReturn(Array.isArray(list) ? list : []);
    }

    if (queryGet.status === 429) {
      livestockItemsCooldownUntil = Date.now() + LIVESTOCK_ITEMS_COOLDOWN_MS;
      if (cached?.data) return { ok: true, data: cached.data };
      return {
        ok: false,
        status: 429,
        error: "Rate limit reached while loading livestock items. Please retry shortly.",
      };
    }
    if (queryGet.status === 401) return queryGet;

    if (queryGet.status === 400 || queryGet.status === 404) {
      livestockItemsCache.set(productId, {
        data: [],
        expiresAt: Date.now() + 60 * 1000,
      });
      return { ok: true, data: [] };
    }

    // 2) Optional GET + JSON body (some backends read req.body on GET).
    const bodyGet = await apiRequest<GetLivestockItemsByProductResponse>(
      PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT,
      {
        method: "GET",
        body: JSON.stringify({ productId }),
      }
    );
    if (bodyGet.ok) {
      const list = bodyGet.data?.data ?? bodyGet.data?.items ?? [];
      return cacheAndReturn(Array.isArray(list) ? list : []);
    }
    if (bodyGet.status === 401) return bodyGet;

    // 3) POST fallback for deployments that only accept a body.
    const post = await apiRequest<GetLivestockItemsByProductResponse>(
      PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT,
      {
        method: "POST",
        body: JSON.stringify({ productId }),
      }
    );
    if (post.ok) {
      const list = post.data?.data ?? post.data?.items ?? [];
      return cacheAndReturn(Array.isArray(list) ? list : []);
    }
    return post;
  })();

  livestockItemsInflight.set(productId, requestPromise);
  try {
    return await requestPromise;
  } finally {
    livestockItemsInflight.delete(productId);
  }
}

/** POST /products/livestock/update-item */
export type UpdateLivestockItemPayload = {
  id: string;
  name: string;
  itemId: string;
  productId: string;
  outletId: string;
  itemQuantityOrWeight: number;
  buyingPrice: number | null;
  sellingPrice: number | null;
  status: boolean;
};

export type UpdateLivestockItemResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem;
  item?: LivestockItem;
  [key: string]: unknown;
};

export async function updateLivestockItem(payload: UpdateLivestockItemPayload) {
  return apiRequest<UpdateLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_UPDATE_ITEM, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Livestock deduct: quantity only (matches backend). */
export type LivestockDeductPayload = {
  livestockItemId: string;
  quantity: number;
};

export type LivestockRestockPayload = {
  livestockItemId: string;
  quantity: number;
  buyingPrice?: number;
  sellingPrice?: number;
};

export type LivestockRestockDeductResponse = {
  success?: boolean;
  message?: string;
  /** Backend returns a RESTOCK history row (`quantity` / `weight`), not the full item. */
  data?: {
    livestockItemId?: string;
    type?: string;
    quantity?: number | null;
    weight?: number | null;
    [key: string]: unknown;
  };
  item?: LivestockItem;
  [key: string]: unknown;
};

export async function restockLivestockItem(payload: LivestockRestockPayload) {
  const body: Record<string, unknown> = {
    livestockItemId: payload.livestockItemId,
    quantity: payload.quantity,
  };
  if (payload.buyingPrice != null && Number.isFinite(payload.buyingPrice)) {
    body.buyingPrice = payload.buyingPrice;
  }
  if (payload.sellingPrice != null && Number.isFinite(payload.sellingPrice)) {
    body.sellingPrice = payload.sellingPrice;
  }
  return apiRequest<LivestockRestockDeductResponse>(PRODUCT_ROUTES.LIVESTOCK_RESTOCK, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deductLivestockItem(payload: LivestockDeductPayload) {
  return apiRequest<LivestockRestockDeductResponse>(PRODUCT_ROUTES.LIVESTOCK_DEDUCT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * POST `/products/livestock/delete-item` — matches `router.post('.../delete-item', ...)`.
 * JSON body is `{ productId: string }` but the server passes that string to Prisma as **`itemId`**
 * (`where: { itemId }`), not the parent product UUID and not the row primary key `id`.
 * Always send the **`itemId`** field from `get-items-by-product` (see `resolveLivestockDeleteKey`).
 */
export type DeleteLivestockItemPayload = {
  /** Must be the livestock row's **itemId**; JSON key stays `productId` for the API. */
  productId: string;
};

/** Resolves the value to send as `productId` in the delete body: trimmed **`item.itemId`**. */
export function resolveLivestockDeleteKey(item: LivestockItem): string | null {
  if (typeof item.itemId === "string" && item.itemId.trim()) return item.itemId.trim();
  return null;
}

export type DeleteLivestockItemResponse = DeleteProductResponse;

export type SendLivestockToProcessingPayload = {
  livestockItemId: string;
  plantId: string;
  quantity: number;
  weight: number;
};

export type SendLivestockToProcessingResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
    batchId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CompleteProcessingOutputLine = {
  productId: string;
  weight: number;
  outletId: string;
};

export type CompleteProcessingPayload = {
  batchId: string;
  wasteWeight: number;
  outputs: CompleteProcessingOutputLine[];
};

export type CompleteProcessingResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type TransferProcessedStockPayload = {
  sourceProductId: string;
  destinationProductId: string;
  sourceOutletId: string;
  destinationOutletId: string;
  weight: number;
};

export async function transferProcessedStock(payload: TransferProcessedStockPayload) {
  const amount = Number(payload.weight);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, status: 400, error: "Transfer weight must be greater than 0." };
  }

  const deductResult = await deductProduct({
    id: payload.sourceProductId,
    weight: amount,
  });
  if (!deductResult.ok) return deductResult;

  const restockResult = await restockProduct({
    id: payload.destinationProductId,
    outletId: payload.destinationOutletId,
    weight: amount,
  });
  if (restockResult.ok) return restockResult;

  // Best-effort rollback so source stock is not left deducted when destination restock fails.
  await restockProduct({
    id: payload.sourceProductId,
    outletId: payload.sourceOutletId,
    weight: amount,
  });

  return {
    ok: false as const,
    status: restockResult.status,
    error:
      restockResult.error ??
      "Transfer failed while restocking destination outlet. Source stock deduction was rolled back.",
  };
}

export type PendingLivestockProcessingItem = {
  batchId: string;
  livestockItemId?: string;
  livestockItemName?: string;
  itemId?: string;
  plantId?: string;
  plantName?: string;
  quantity?: number;
  weight?: number;
  sentWeight?: number;
  [key: string]: unknown;
};

export type GetPendingLivestockProcessingResponse = {
  success?: boolean;
  message?: string;
  data?: PendingLivestockProcessingItem[];
  items?: PendingLivestockProcessingItem[];
  [key: string]: unknown;
};

export async function deleteLivestockItem(payload: DeleteLivestockItemPayload) {
  const itemIdForBody = payload.productId.trim();
  if (!itemIdForBody) {
    return { ok: false as const, status: 400, error: "Livestock itemId is required." };
  }
  return normalizeProductDeleteApiResult(
    await apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_DELETE_ITEM, {
      method: "POST",
      body: JSON.stringify({ productId: itemIdForBody }),
    })
  );
}

export async function sendLivestockToProcessing(payload: SendLivestockToProcessingPayload) {
  // Match backend contract exactly.
  return apiRequest<SendLivestockToProcessingResponse>(PRODUCT_ROUTES.LIVESTOCK_SEND_TO_PROCESSING, {
    method: "POST",
    body: JSON.stringify({
      livestockItemId: payload.livestockItemId,
      plantId: payload.plantId,
      quantity: payload.quantity,
      weight: payload.weight,
    }),
  });
}

export async function completeLivestockProcessing(payload: CompleteProcessingPayload) {
  const body = {
    batchId: payload.batchId,
    wasteWeight: payload.wasteWeight,
    outputs: payload.outputs,
  };
  return apiRequest<CompleteProcessingResponse>(PRODUCT_ROUTES.LIVESTOCK_COMPLETE_PROCESSING, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPendingLivestockProcessing(): Promise<
  | { ok: true; data: PendingLivestockProcessingItem[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetPendingLivestockProcessingResponse>(
    PRODUCT_ROUTES.LIVESTOCK_GET_PENDING_PROCESSING,
    { method: "GET" }
  );
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.items ?? [];
  const parseNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
  };
  const getString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value : undefined;

  const data = Array.isArray(list)
    ? list
        .map((item) => {
          const row = item as {
            id?: unknown;
            batchId?: unknown;
            livestockItemId?: unknown;
            livestockItemName?: unknown;
            itemId?: unknown;
            plantId?: unknown;
            plantName?: unknown;
            quantity?: unknown;
            qty?: unknown;
            sentQuantity?: unknown;
            inputQuantity?: unknown;
            itemQuantityOrWeight?: unknown;
            weight?: unknown;
            sentWeight?: unknown;
            inputWeight?: unknown;
            livestockItem?: { id?: unknown; itemId?: unknown; name?: unknown };
            processingPlant?: { id?: unknown; name?: unknown };
            plant?: { id?: unknown; name?: unknown };
          };
          const batchId =
            getString(row.batchId) ??
            getString(row.id) ??
            getString((item as { processingBatchId?: unknown }).processingBatchId) ??
            getString((item as { batch?: unknown }).batch) ??
            "";
          if (!batchId) return null;

          const livestockItemId =
            getString(row.livestockItemId) ??
            getString(row.livestockItem?.id) ??
            getString((item as { item?: { id?: unknown } }).item?.id);
          const itemId =
            getString(row.itemId) ??
            getString(row.livestockItem?.itemId) ??
            getString((item as { itemCode?: unknown }).itemCode);
          const livestockItemName =
            getString(row.livestockItemName) ??
            getString(row.livestockItem?.name) ??
            getString((item as { itemName?: unknown }).itemName);
          const plantId =
            getString(row.plantId) ??
            getString(row.processingPlant?.id) ??
            getString(row.plant?.id);
          const plantName =
            getString(row.plantName) ??
            getString(row.processingPlant?.name) ??
            getString(row.plant?.name);
          const quantity =
            parseNumber(row.quantity) ??
            parseNumber(row.qty) ??
            parseNumber(row.sentQuantity) ??
            parseNumber(row.inputQuantity);
          const weight =
            parseNumber(row.weight) ??
            parseNumber(row.sentWeight) ??
            parseNumber(row.inputWeight) ??
            parseNumber(row.itemQuantityOrWeight);

          return {
            ...item,
            batchId,
            livestockItemId,
            livestockItemName,
            itemId,
            plantId,
            plantName,
            quantity,
            weight,
            sentWeight: parseNumber(row.sentWeight),
          } as PendingLivestockProcessingItem;
        })
        .filter((item): item is PendingLivestockProcessingItem => item !== null)
    : [];
  return { ok: true, data };
}

// --- Livestock opening / closing stock (single API, doc-aligned shape) ---

export type OpeningStockItem = {
  inventoryId: string;
  productName: string;
  productNumber: string;
  unit: string;
  openingQuantity: number;
  addedQuantity: number;
  consumedQuantity: number;
  closingQuantity: number;
  buyingPrice?: number;
  totalPrice?: number;
};

export type OpeningStockByDate = {
  date: string;
  totalOpening: number;
  totalAdded: number;
  totalConsumed: number;
  totalClosing: number;
  items: OpeningStockItem[];
};

export type OpeningStockData = {
  from: string;
  to: string;
  totalQuantity: number;
  totalPrice: number;
  totalRecords: number;
  openingStockByDate: OpeningStockByDate[];
};

export type OpeningStockApiResponse = {
  success?: boolean;
  message?: string;
  data?: OpeningStockData;
  [key: string]: unknown;
};

function parseOpeningStockNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseOpeningStockItem(raw: unknown): OpeningStockItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const inventoryId =
    typeof row.inventoryId === "string"
      ? row.inventoryId
      : typeof row.id === "string"
        ? row.id
        : "";
  const productName = typeof row.productName === "string" ? row.productName : "";
  const productNumber =
    typeof row.productNumber === "string"
      ? row.productNumber
      : typeof row.productId === "string"
        ? row.productId
        : "";
  const unit = typeof row.unit === "string" ? row.unit : "";
  if (!inventoryId && !productName) return null;
  return {
    inventoryId: inventoryId || productNumber || "unknown",
    productName: productName || productNumber || "—",
    productNumber,
    unit,
    openingQuantity: parseOpeningStockNum(row.openingQuantity),
    addedQuantity: parseOpeningStockNum(row.addedQuantity),
    consumedQuantity: parseOpeningStockNum(row.consumedQuantity),
    closingQuantity: parseOpeningStockNum(row.closingQuantity),
    buyingPrice: parseOpeningStockNum(row.buyingPrice) || undefined,
    totalPrice: parseOpeningStockNum(row.totalPrice) || undefined,
  };
}

function parseOpeningStockByDate(raw: unknown): OpeningStockByDate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row.date === "string" ? row.date : "";
  if (!date) return null;
  const itemsRaw = row.items;
  const items: OpeningStockItem[] = Array.isArray(itemsRaw)
    ? itemsRaw.map(parseOpeningStockItem).filter((x): x is OpeningStockItem => x !== null)
    : [];
  return {
    date,
    totalOpening: parseOpeningStockNum(row.totalOpening),
    totalAdded: parseOpeningStockNum(row.totalAdded),
    totalConsumed: parseOpeningStockNum(row.totalConsumed),
    totalClosing: parseOpeningStockNum(row.totalClosing),
    items,
  };
}

function normalizeOpeningStockPayload(payload: unknown): OpeningStockData | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const inner = (root.data ?? root) as Record<string, unknown>;
  const from = typeof inner.from === "string" ? inner.from : "";
  const to = typeof inner.to === "string" ? inner.to : "";
  const byDateRaw = inner.openingStockByDate;
  const openingStockByDate: OpeningStockByDate[] = Array.isArray(byDateRaw)
    ? byDateRaw.map(parseOpeningStockByDate).filter((x): x is OpeningStockByDate => x !== null)
    : [];
  return {
    from,
    to,
    totalQuantity: parseOpeningStockNum(inner.totalQuantity),
    totalPrice: parseOpeningStockNum(inner.totalPrice),
    totalRecords: parseOpeningStockNum(inner.totalRecords),
    openingStockByDate,
  };
}

const DUMMY_OPENING_STOCK_MAX_DAYS = 31;

function parseCalendarDateParts(isoDate: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null;
  return { y, m: mo, d: day };
}

function calendarDateToUtcMidnight(parts: { y: number; m: number; d: number }): number {
  return Date.UTC(parts.y, parts.m - 1, parts.d);
}

function utcMidnightToIsoDate(utcMs: number): string {
  const x = new Date(utcMs);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const d = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Placeholder rows when the opening-stock API is not deployed yet (404 / route messages). */
function buildDummyOpeningStockData(from: string, to: string): OpeningStockData {
  const startParts = parseCalendarDateParts(from);
  const endParts = parseCalendarDateParts(to);
  if (!startParts || !endParts) {
    return {
      from,
      to,
      totalQuantity: 0,
      totalPrice: 0,
      totalRecords: 0,
      openingStockByDate: [],
    };
  }
  const startMs = calendarDateToUtcMidnight(startParts);
  const endMs = calendarDateToUtcMidnight(endParts);
  const dayMs = 86400000;
  const openingStockByDate: OpeningStockByDate[] = [];
  let totalQuantity = 0;
  let totalPrice = 0;
  let totalRecords = 0;

  for (let i = 0, ms = startMs; ms <= endMs && i < DUMMY_OPENING_STOCK_MAX_DAYS; i++, ms += dayMs) {
    const dateStr = utcMidnightToIsoDate(ms);
    const items: OpeningStockItem[] = [
      {
        inventoryId: "demo-inv-1",
        productName: "Sample stock item A",
        productNumber: "DEMO-001",
        unit: "kg",
        openingQuantity: 120,
        addedQuantity: 25,
        consumedQuantity: 18,
        closingQuantity: 127,
        buyingPrice: 4.5,
        totalPrice: 571.5,
      },
      {
        inventoryId: "demo-inv-2",
        productName: "Sample stock item B",
        productNumber: "DEMO-002",
        unit: "head",
        openingQuantity: 8,
        addedQuantity: 1,
        consumedQuantity: 0,
        closingQuantity: 9,
        buyingPrice: 220,
        totalPrice: 1980,
      },
    ];
    const totalOpening = items.reduce((s, x) => s + x.openingQuantity, 0);
    const totalAdded = items.reduce((s, x) => s + x.addedQuantity, 0);
    const totalConsumed = items.reduce((s, x) => s + x.consumedQuantity, 0);
    const totalClosing = items.reduce((s, x) => s + x.closingQuantity, 0);
    totalQuantity += totalClosing;
    totalPrice += items.reduce((s, x) => s + (x.totalPrice ?? 0), 0);
    totalRecords += items.length;
    openingStockByDate.push({
      date: dateStr,
      totalOpening,
      totalAdded,
      totalConsumed,
      totalClosing,
      items,
    });
  }

  return {
    from,
    to,
    totalQuantity,
    totalPrice,
    totalRecords,
    openingStockByDate,
  };
}

function shouldUseDummyOpeningStockFallback(error: string, status: number): boolean {
  if (status === 401) return false;
  if (status === 404 || status === 405) return true;
  const e = error.toLowerCase();
  if (e.includes("route not found") || e.includes("wrong api method")) return true;
  return false;
}

async function getOpeningStockByRoute(
  route: string,
  from: string,
  to: string
): Promise<{ ok: true; data: OpeningStockData } | { ok: false; error: string; status: number }> {
  const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const result = await apiRequest<OpeningStockApiResponse>(`${route}${qs}`, { method: "GET" });
  if (!result.ok) {
    if (result.status === 401) return result;
    if (shouldUseDummyOpeningStockFallback(result.error, result.status)) {
      return { ok: true, data: buildDummyOpeningStockData(from, to) };
    }
    return result;
  }
  const normalized = normalizeOpeningStockPayload(result.data);
  if (!normalized) {
    return {
      ok: false,
      status: 422,
      error: "Invalid opening stock response shape.",
    };
  }
  return { ok: true, data: normalized };
}

/** Set to true when GET `/products/livestock/opening-stock` is implemented on the backend. */
const LIVESTOCK_OPENING_STOCK_API_ENABLED = false;

export async function getOpeningStock(
  from: string,
  to: string
): Promise<{ ok: true; data: OpeningStockData } | { ok: false; error: string; status: number }> {
  if (!LIVESTOCK_OPENING_STOCK_API_ENABLED) {
    return {
      ok: true,
      data: {
        from,
        to,
        totalQuantity: 0,
        totalPrice: 0,
        totalRecords: 0,
        openingStockByDate: [],
      },
    };
  }
  return getOpeningStockByRoute(PRODUCT_ROUTES.LIVESTOCK_OPENING_STOCK, from, to);
}

export async function getProcessedOpeningStock(
  from: string,
  to: string
): Promise<{ ok: true; data: OpeningStockData } | { ok: false; error: string; status: number }> {
  return getOpeningStockByRoute(PRODUCT_ROUTES.PROCESSED_OPENING_STOCK, from, to);
}

type ProcessedWasteHistoryApiResponse = LivestockWasteHistoryApiResponse;

export async function getProcessedProductWasteHistory(
  productId: string,
  range?: WasteHistoryDateRange
): Promise<
  { ok: true; data: LivestockWasteHistoryEntry[] } | { ok: false; error: string; status: number }
> {
  const sp = new URLSearchParams();
  sp.set("productId", productId);
  if (range?.from) sp.set("from", range.from);
  if (range?.to) sp.set("to", range.to);
  const qs = `?${sp.toString()}`;
  const result = await apiRequest<ProcessedWasteHistoryApiResponse>(
    `${PRODUCT_ROUTES.PROCESSED_WASTE_HISTORY}${qs}`,
    { method: "GET" }
  );
  if (!result.ok) return result;
  const payload = result.data;
  let list: unknown[] = [];
  const nested = payload?.data;
  if (Array.isArray(nested)) {
    list = nested;
  } else if (nested && typeof nested === "object" && Array.isArray((nested as { items?: unknown[] }).items)) {
    list = (nested as { items: unknown[] }).items;
  } else if (Array.isArray(payload?.items)) {
    list = payload.items as unknown[];
  }
  const data = list
    .map((row, i) => parseWasteHistoryEntry(row, i))
    .filter((x): x is LivestockWasteHistoryEntry => x !== null);
  return { ok: true, data };
}
