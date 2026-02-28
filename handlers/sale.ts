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
