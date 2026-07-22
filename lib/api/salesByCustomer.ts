import { apiRequest } from "@/lib/api/client";
import { SALES_ROUTES } from "@/lib/api/routes";

export type SalesByCustomerApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  sales?: unknown;
  transactions?: unknown;
  error?: unknown;
  [key: string]: unknown;
};

/** GET /v1/sales/get-by-customer?customer=... */
export async function fetchSalesByCustomer(
  customer: string,
): Promise<
  { ok: true; data: SalesByCustomerApiResponse } | { ok: false; error: string; status: number }
> {
  const route = `${SALES_ROUTES.GET_BY_CUSTOMER}?customer=${encodeURIComponent(customer.trim())}`;
  const result = await apiRequest<SalesByCustomerApiResponse>(route, { method: "GET" });
  if (!result.ok) return result;
  if (result.data?.success === false) {
    return { ok: false, error: result.data.message ?? "Request failed.", status: 400 };
  }
  return { ok: true, data: result.data ?? {} };
}