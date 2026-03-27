import { apiRequest } from "@/lib/api/client";
import { SALES_ROUTES } from "@/lib/api/routes";

export type SaleItemPayload = {
  name: string;
  contact: string;
  customerTypeId: string;
  productId: string;
  outletId: string;
  /** For Live products: weight in kg */
  weight?: number;
  /** For Processed products: quantity (units) */
  quantity?: number;
};

/** Transaction/sale record for list view. API may return type/customerType/customer as { id, name }. */
export type SaleTransaction = {
  id: string;
  transactionId?: string;
  date?: string;
  createdAt?: string;
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

/** Raw transaction from API when data is object keyed by transactionId */
type RawTransactionFromApi = {
  transactionId?: string;
  name?: string;
  contact?: string;
  outlet?: { id?: string; name?: string };
  createdAt?: string;
  items?: Array<{
    customerType?: { name?: string };
    product?: { name?: string };
    amount?: number;
    weight?: number;
  }>;
  totalAmount?: number;
  [key: string]: unknown;
};

function normalizeTransactionList(
  raw: GetSalesResponse["data"]
): SaleTransaction[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw as SaleTransaction[];
  }
  const obj = raw as Record<string, RawTransactionFromApi>;
  return Object.values(obj).map((tx) => {
    const types = tx.items
      ?.map((i) => i.customerType?.name)
      .filter(Boolean) ?? [];
    const uniqueTypes = [...new Set(types)];
    const typeDisplay =
      uniqueTypes.length === 0 ? "—" : uniqueTypes.join(", ");
    return {
      id: tx.transactionId ?? "",
      transactionId: tx.transactionId,
      name: tx.name,
      contact: tx.contact,
      createdAt: tx.createdAt,
      date: tx.createdAt,
      outletId: tx.outlet?.id,
      outlet: tx.outlet,
      itemsCount: tx.items?.length ?? 0,
      itemCount: tx.items?.length ?? 0,
      amount: tx.totalAmount,
      total: tx.totalAmount,
      totalAmount: tx.totalAmount,
      type: typeDisplay,
      items: tx.items,
    } as SaleTransaction;
  });
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
  data?: LivestockSale[] | Record<string, unknown>;
  sales?: LivestockSale[];
  transactions?: LivestockSale[] | Record<string, unknown>;
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

function normalizeLivestockSales(raw: unknown): LivestockSale[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((entry) => normalizeSaleEntry(entry));
  if (typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (obj.data != null) return normalizeLivestockSales(obj.data);
  if (obj.sales != null) return normalizeLivestockSales(obj.sales);
  if (obj.transactions != null) return normalizeLivestockSales(obj.transactions);
  return Object.values(obj).flatMap((entry) => normalizeSaleEntry(entry));
}

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

/** POST /sales/get-by-product-id with body { productId } */
export async function getSalesByProductId(
  productId: string
): Promise<
  | { ok: true; data: SaleTransaction[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetSalesResponse>(
    SALES_ROUTES.GET_BY_PRODUCT_ID,
    {
      method: "POST",
      body: JSON.stringify({ productId }),
    }
  );
  if (!result.ok) return result;
  const raw = result.data?.data ?? result.data?.sales ?? result.data?.transactions;
  const data = normalizeTransactionList(raw);
  return { ok: true, data };
}

export async function createSale(items: SaleItemPayload[]) {
  return apiRequest<CreateSaleResponse>(SALES_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(items),
  });
}

export async function createLivestockSale(items: LivestockSalePayload[]) {
  return apiRequest<CreateSaleResponse>(SALES_ROUTES.LIVESTOCK_CREATE, {
    method: "POST",
    body: JSON.stringify(items),
  });
}

export async function getLivestockSales(): Promise<
  | { ok: true; data: LivestockSale[] }
  | { ok: false; error: string; status: number }
> {
  const getResult = await apiRequest<GetLivestockSalesResponse>(SALES_ROUTES.LIVESTOCK_GET, {
    method: "GET",
  });
  if (getResult.ok) {
    const raw = getResult.data?.data ?? getResult.data?.sales ?? getResult.data?.transactions ?? [];
    return { ok: true, data: normalizeLivestockSales(raw) };
  }

  // Fallback for backends that define this endpoint as POST.
  const postResult = await apiRequest<GetLivestockSalesResponse>(SALES_ROUTES.LIVESTOCK_GET, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!postResult.ok) return getResult;
  const raw = postResult.data?.data ?? postResult.data?.sales ?? postResult.data?.transactions ?? [];
  return { ok: true, data: normalizeLivestockSales(raw) };
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
