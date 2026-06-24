import { apiRequest } from "@/lib/api/client";
import { fetchSalesByProductId } from "@/lib/api/salesByProduct";
import { SALES_ROUTES } from "@/lib/api/routes";
import {
  toApiPaymentMethod,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";

export type SaleItemPayload = {
  name: string;
  contact: string;
  customerTypeId: string;
  productId: string;
  outletId: string;
  /** Sale line amount in kg; processed stock is deducted by weight */
  weight?: number;
  /** Line total before discount; explicit value overrides weight × price on backend */
  amount?: number;
  /** Discount applied to this line (proportional share of cart discount) */
  discountAmount?: number;
  paymentMethod: SalePaymentMethod;
};

/** Waste sale line — deducts from a specific waste product in the current outlet. */
export type WasteSaleItemPayload = {
  name: string;
  contact: string;
  customerTypeId: string;
  productId: string;
  outletId: string;
  weight: number;
  amount: number;
  paymentMethod: SalePaymentMethod;
  wasteSales: true;
  discountAmount?: number;
};

/** Transaction/sale record for list view. API may return type/customerType/customer as { id, name }. */
export type SaleTransaction = {
  id: string;
  transactionId?: string;
  date?: string;
  createdAt?: string;
  /** Per-line sale weight (kg); primary field for processed stock deduction per get-by-product-id. */
  weight?: number | null;
  quantity?: number | null;
  name?: string;
  customer?: string | { id?: string; name?: string };
  contact?: string;
  customerType?: string | { id?: string; name?: string };
  customerTypeId?: string;
  type?: string | { id?: string; name?: string };
  itemsCount?: number;
  itemCount?: number;
  amount?: number;
  total?: number;
  totalAmount?: number;
  discountAmount?: number;
  paymentMethod?: string;
  outletId?: string;
  outlet?: { id?: string; name?: string };
  items?: Array<{
    customerType?: { name?: string };
    product?: { name?: string };
    amount?: number;
    weight?: number;
  }>;
  [key: string]: unknown;
};

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

type RawTransactionLineFromApi = {
  customerType?: { name?: string };
  product?: { name?: string };
  amount?: number;
  weight?: number;
  discountAmount?: number;
  paymentMethod?: string;
  [key: string]: unknown;
};

/** Raw transaction from API when data is object keyed by transactionId */
type RawTransactionFromApi = {
  transactionId?: string;
  name?: string;
  contact?: string;
  outlet?: { id?: string; name?: string };
  createdAt?: string;
  discountAmount?: number;
  paymentMethod?: string;
  items?: RawTransactionLineFromApi[];
  totalAmount?: number;
  [key: string]: unknown;
};

function pickTransactionPaymentMethod(
  tx: RawTransactionFromApi,
  items: RawTransactionLineFromApi[] | undefined
): string | undefined {
  const topLevel = getString(tx.paymentMethod);
  if (topLevel) return topLevel;

  const fromItems =
    items
      ?.map((item) => getString(item.paymentMethod))
      .filter((value): value is string => !!value) ?? [];
  if (fromItems.length === 0) return undefined;

  const unique = [...new Set(fromItems)];
  return unique.length === 1 ? unique[0] : fromItems[0];
}

function sumTransactionDiscountAmount(
  tx: RawTransactionFromApi,
  items: RawTransactionLineFromApi[] | undefined
): number | undefined {
  const topLevel = getNumber(tx.discountAmount);
  if (topLevel != null) return topLevel;

  if (!items?.length) return undefined;

  let sum = 0;
  let hasValue = false;
  for (const item of items) {
    const lineDiscount = getNumber(item.discountAmount);
    if (lineDiscount == null) continue;
    sum += lineDiscount;
    hasValue = true;
  }

  return hasValue ? Math.round(sum * 100) / 100 : undefined;
}

function normalizeGroupedTransaction(tx: RawTransactionFromApi): SaleTransaction {
  const items = tx.items;
  const types = items?.map((i) => i.customerType?.name).filter(Boolean) ?? [];
  const uniqueTypes = [...new Set(types)];
  const typeDisplay = uniqueTypes.length === 0 ? "—" : uniqueTypes.join(", ");
  const paymentMethod = pickTransactionPaymentMethod(tx, items);
  const discountAmount = sumTransactionDiscountAmount(tx, items);

  return {
    id: tx.transactionId ?? "",
    transactionId: tx.transactionId,
    name: tx.name,
    contact: tx.contact,
    createdAt: tx.createdAt,
    date: tx.createdAt,
    outletId: tx.outlet?.id,
    outlet: tx.outlet,
    itemsCount: items?.length ?? 0,
    itemCount: items?.length ?? 0,
    amount: tx.totalAmount,
    total: tx.totalAmount,
    totalAmount: tx.totalAmount,
    discountAmount,
    paymentMethod,
    type: typeDisplay,
    items,
  } as SaleTransaction;
}

function normalizeTransactionList(
  raw: GetSalesResponse["data"]
): SaleTransaction[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((entry) =>
      entry && typeof entry === "object"
        ? normalizeGroupedTransaction(entry as RawTransactionFromApi)
        : (entry as SaleTransaction)
    );
  }
  const obj = raw as Record<string, RawTransactionFromApi>;
  return Object.values(obj).map(normalizeGroupedTransaction);
}

export type GetSalesResponse = {
  success?: boolean;
  message?: string;
  data?:
    | SaleTransaction[]
    | Record<string, RawTransactionFromApi>;
  sales?: SaleTransaction[];
  transactions?: SaleTransaction[];
  [key: string]: unknown;
};

export type CreateSaleResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type LivestockSalePayload = {
  name: string;
  contact: string;
  livestockItemId: string;
  itemQuantityOrWeight: number;
  amount: number;
  paymentMethod: SalePaymentMethod;
};

export type LivestockSale = {
  id?: string;
  transactionId?: string;
  name?: string;
  contact?: string;
  livestockItemId?: string;
  quantity?: number;
  itemQuantityOrWeight?: number;
  weight?: number;
  amount?: number;
  totalAmount?: number;
  createdAt?: string;
  date?: string;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type GetLivestockSalesResponse = {
  success?: boolean;
  message?: string;
  /** May be `{ data: LivestockSale[], page, limit }` or legacy shapes. */
  data?: LivestockSale[] | Record<string, unknown>;
  sales?: LivestockSale[];
  transactions?: LivestockSale[] | Record<string, unknown>;
  [key: string]: unknown;
};

/** Parsed result for GET `/sales/livestock/get?page=&limit=` */
export type LivestockSalesPageResult = {
  rows: LivestockSale[];
  page: number;
  limit: number;
  /** When true, caller may fetch `page + 1` (`rows.length` reached `limit`). */
  hasMore: boolean;
};

export const LIVESTOCK_SALES_LIST_DEFAULT_LIMIT = 10;
export const LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT = 500;

function normalizeSaleEntry(entry: unknown): LivestockSale[] {
  if (!entry || typeof entry !== "object") return [];
  const obj = entry as Record<string, unknown>;
  const base: LivestockSale = {
    id: getString(obj.id),
    transactionId: getString(obj.transactionId),
    name: getString(obj.name),
    contact: getString(obj.contact),
    createdAt: getString(obj.createdAt),
    date: getString(obj.date),
    livestockItemId: getString(obj.livestockItemId) ?? getString(obj.itemId),
    quantity: getNumber(obj.quantity),
    itemQuantityOrWeight:
      getNumber(obj.itemQuantityOrWeight) ?? getNumber(obj.quantity) ?? getNumber(obj.weight),
    weight: getNumber(obj.weight) ?? getNumber(obj.itemQuantityOrWeight) ?? getNumber(obj.quantity),
    amount: getNumber(obj.amount) ?? getNumber(obj.totalAmount),
    totalAmount: getNumber(obj.totalAmount),
  };

  const items = Array.isArray(obj.items) ? obj.items : [];
  if (items.length === 0) return [base];

  return items.map((item, index) => {
    const itemObj = item as Record<string, unknown>;
    const livestockItemObj =
      itemObj.livestockItem && typeof itemObj.livestockItem === "object"
        ? (itemObj.livestockItem as Record<string, unknown>)
        : null;

    const livestockItemId =
      getString(itemObj.livestockItemId) ??
      getString(itemObj.itemId) ??
      (livestockItemObj ? getString(livestockItemObj.id) ?? getString(livestockItemObj.itemId) : undefined) ??
      base.livestockItemId;

    const itemQuantityOrWeight =
      getNumber(itemObj.itemQuantityOrWeight) ??
      getNumber(itemObj.quantity) ??
      getNumber(itemObj.weight) ??
      base.itemQuantityOrWeight ??
      base.quantity ??
      base.weight;
    const amount =
      getNumber(itemObj.amount) ??
      getNumber(itemObj.totalAmount) ??
      base.amount ??
      base.totalAmount;

    return {
      ...base,
      id: base.id ? `${base.id}-${index}` : undefined,
      livestockItemId,
      quantity: itemQuantityOrWeight,
      itemQuantityOrWeight,
      weight: itemQuantityOrWeight,
      amount,
      items: [itemObj],
    };
  });
}

/** Normalize legacy payloads (arrays, `{ sales }`, grouped maps) into flat rows. */
function flattenLegacyLivestockShape(raw: unknown): LivestockSale[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((entry) => normalizeSaleEntry(entry));
  if (typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if ("data" in obj && Array.isArray(obj.data)) {
    return obj.data.flatMap((entry: unknown) => normalizeSaleEntry(entry));
  }
  if ("data" in obj && obj.data != null) return flattenLegacyLivestockShape(obj.data);
  if (obj.sales != null) return flattenLegacyLivestockShape(obj.sales);
  if (obj.transactions != null) return flattenLegacyLivestockShape(obj.transactions);
  return Object.values(obj).flatMap((entry) => normalizeSaleEntry(entry));
}

/** Double-wrapped `{ data: { data, page, limit } }` from some uni-response serializers. */
function unwrapPaginatedEnvelopeOnce(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const o = body as Record<string, unknown>;
  if (
    o.data !== null &&
    typeof o.data === "object" &&
    !Array.isArray(o.data) &&
    Array.isArray((o.data as Record<string, unknown>).data) &&
    (getNumber((o.data as Record<string, unknown>).page) != null ||
      getNumber((o.data as Record<string, unknown>).limit) != null)
  ) {
    return o.data;
  }
  return body;
}

function parseLivestockSalesPayload(
  body: unknown,
  requestPage: number,
  requestLimit: number
): LivestockSalesPageResult {
  const inner = unwrapPaginatedEnvelopeOnce(body);
  if (inner == null) {
    return { rows: [], page: Math.max(requestPage, 1), limit: requestLimit, hasMore: false };
  }

  const pageClamp = Math.max(1, Math.floor(requestPage));
  const limitClamp = Math.max(1, Math.floor(requestLimit));

  if (Array.isArray(inner)) {
    const rows = inner.flatMap((entry) => normalizeSaleEntry(entry));
    const hasMore = rows.length >= limitClamp;
    return { rows, page: pageClamp, limit: limitClamp, hasMore };
  }

  if (typeof inner !== "object") {
    return { rows: [], page: pageClamp, limit: limitClamp, hasMore: false };
  }

  const o = inner as Record<string, unknown>;
  const nestedData = o.data;
  const pageFromApi = getNumber(o.page);
  const limitFromApi = getNumber(o.limit);

  if (Array.isArray(nestedData) && (pageFromApi != null || limitFromApi != null)) {
    const rows = nestedData.flatMap((entry: unknown) => normalizeSaleEntry(entry));
    const page = Math.max(1, pageFromApi ?? pageClamp);
    const limit = Math.max(1, limitFromApi ?? limitClamp);
    const hasMore = rows.length >= limit;
    return { rows, page, limit, hasMore };
  }

  if (Array.isArray(nestedData)) {
    const rows = nestedData.flatMap((entry: unknown) => normalizeSaleEntry(entry));
    const hasMore = rows.length >= limitClamp;
    return {
      rows,
      page: pageClamp,
      limit: nestedData.length > 0 ? Math.max(limitClamp, nestedData.length) : limitClamp,
      hasMore,
    };
  }

  const rowsFlat = flattenLegacyLivestockShape(inner);
  const hasMore = rowsFlat.length >= limitClamp;
  return { rows: rowsFlat, page: pageClamp, limit: limitClamp, hasMore };
}

function livestockGetQuery(page: number, limit: number): string {
  const p = Math.max(1, Math.floor(page));
  const l = Math.max(1, Math.min(Math.floor(limit), LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT));
  return `?page=${encodeURIComponent(String(p))}&limit=${encodeURIComponent(String(l))}`;
}

/** Processed sales listing from `/sales/get` — outlet scoping may differ from `/sales/dashboardSales`; confirm with backend when reconciling totals. */
export async function getSales(): Promise<
  | { ok: true; data: SaleTransaction[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetSalesResponse>(SALES_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const raw = result.data?.data ?? result.data?.sales ?? result.data?.transactions;
  const data = normalizeTransactionList(raw);
  return { ok: true, data };
}

/**
 * GET /v1/sales/get-by-product-id with JSON body `{ productId }` (axios).
 * Backend registers GET only and reads `req.body` — same pattern as livestock history.
 */
export async function getSalesByProductId(
  productId: string
): Promise<
  | { ok: true; data: SaleTransaction[] }
  | { ok: false; error: string; status: number }
> {
  const result = await fetchSalesByProductId(productId);
  if (!result.ok) return result;
  const raw =
    result.data?.data ?? result.data?.sales ?? result.data?.transactions;
  const data = normalizeTransactionList(raw as GetSalesResponse["data"]);
  return { ok: true, data };
}

function toProcessedSaleCreateBody(items: SaleItemPayload[]) {
  return items.map(({ paymentMethod, discountAmount = 0, ...rest }) => ({
    ...rest,
    discountAmount,
    paymentMethod: toApiPaymentMethod(paymentMethod),
  }));
}

export async function createSale(items: SaleItemPayload[]) {
  return apiRequest<CreateSaleResponse>(SALES_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(toProcessedSaleCreateBody(items)),
  });
}

function toWasteSaleCreateBody(item: WasteSaleItemPayload) {
  return [
    {
      name: item.name,
      contact: item.contact,
      customerTypeId: item.customerTypeId,
      productId: item.productId,
      outletId: item.outletId,
      weight: item.weight,
      amount: item.amount,
      paymentMethod: toApiPaymentMethod(item.paymentMethod),
      wasteSales: true as const,
      discountAmount: item.discountAmount ?? 0,
    },
  ];
}

/** POST /v1/sales/create with a single waste sale line (v1 — backend processes one item only). */
export async function createWasteSale(item: WasteSaleItemPayload) {
  return apiRequest<CreateSaleResponse>(SALES_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(toWasteSaleCreateBody(item)),
  });
}

/** Body shape for POST /sales/livestock/create — backends often validate `quantity`, not only `itemQuantityOrWeight`. */
function toLivestockSaleCreateBody(items: LivestockSalePayload[]) {
  return items.map((item) => {
    const qty = item.itemQuantityOrWeight;
    return {
      name: item.name,
      contact: item.contact,
      livestockItemId: item.livestockItemId,
      amount: item.amount,
      paymentMethod: toApiPaymentMethod(item.paymentMethod),
      itemQuantityOrWeight: qty,
      quantity: qty,
      weight: qty,
    };
  });
}

export async function createLivestockSale(
  items: LivestockSalePayload[]
): Promise<
  | { ok: true; data: CreateSaleResponse }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<CreateSaleResponse>(SALES_ROUTES.LIVESTOCK_CREATE, {
    method: "POST",
    body: JSON.stringify(toLivestockSaleCreateBody(items)),
  });
  if (!result.ok) return result;
  const data = result.data;
  if (data && typeof data === "object" && data.success === false) {
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Request failed.";
    return { ok: false, error: msg, status: 400 };
  }
  return result;
}

/** Livestock list is paginated server-side; dashboard summaries use at most LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT rows per request. */
export async function getLivestockSales(options?: {
  page?: number;
  limit?: number;
}): Promise<
  | { ok: true; data: LivestockSalesPageResult }
  | { ok: false; error: string; status: number }
> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? LIVESTOCK_SALES_LIST_DEFAULT_LIMIT;
  const path = `${SALES_ROUTES.LIVESTOCK_GET}${livestockGetQuery(page, limit)}`;

  const getResult = await apiRequest<GetLivestockSalesResponse>(path, {
    method: "GET",
  });
  if (getResult.ok) {
    const body =
      getResult.data?.data ??
      getResult.data?.sales ??
      getResult.data?.transactions ??
      [];
    const data = parseLivestockSalesPayload(body, page, limit);
    return { ok: true, data };
  }

  /** Fallback when route is POST-only; include paging in body when possible. */
  const postResult = await apiRequest<GetLivestockSalesResponse>(SALES_ROUTES.LIVESTOCK_GET, {
    method: "POST",
    body: JSON.stringify({
      page: Math.max(1, Math.floor(page)),
      limit: Math.max(1, Math.floor(limit)),
    }),
  });
  if (!postResult.ok) return getResult;
  const body =
    postResult.data?.data ?? postResult.data?.sales ?? postResult.data?.transactions ?? [];
  return { ok: true, data: parseLivestockSalesPayload(body, page, limit) };
}

/** Sales by product item from /sales/dashboardSales */
export type SalesByProductItem = {
  productId: string;
  productName: string;
  totalAmount: number;
  totalQuantity: number;
  totalWeight: number;
};

/** Sales by outlet item from /sales/dashboardSales */
export type SalesByOutletItem = {
  outletId: string;
  outletName: string;
  totalAmount: number;
};

/** Sales by customer item from /sales/dashboardSales */
export type SalesByCustomerItem = {
  customerName: string;
  totalAmount: number;
  totalQuantity: number;
  totalWeight: number;
};

/** Inner data from /sales/dashboardSales */
export type DashboardSalesData = {
  totalRevenue?: number;
  totalQuantity?: number;
  totalWeight?: number;
  totalTransactions?: number;
  salesByProduct?: SalesByProductItem[];
  salesByOutlet?: SalesByOutletItem[];
  salesByCustomer?: SalesByCustomerItem[];
  [key: string]: unknown;
};

/** Full API response for /sales/dashboardSales */
export type DashboardSalesResponse = {
  success?: boolean;
  message?: string;
  timestamp?: string;
  data?: DashboardSalesData;
  [key: string]: unknown;
};

export async function getDashboardSales(): Promise<
  | { ok: true; data: DashboardSalesResponse }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<DashboardSalesResponse>(
    SALES_ROUTES.DASHBOARD_SALES,
    { method: "GET" }
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data ?? {} };
}

export type RedeemRewardsRequest = {
  name: string;
  contact?: string | null;
  outletId: string;
  rewardProductId: string;
  redeemWeight: number;
};

export type RedeemRewardsResponse = {
  success?: boolean;
  message?: string;
  timestamp?: string;
  data?: RedeemRewardsRequest;
};

export async function redeemRewards(
  body: RedeemRewardsRequest
): Promise<
  | { ok: true; data: RedeemRewardsRequest }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<RedeemRewardsResponse>(
    SALES_ROUTES.REDEEM,
    { method: "POST", body: JSON.stringify(body) }
  );
  if (!result.ok) return result;
  const data = result.data?.data ?? body;
  return { ok: true, data };
}
