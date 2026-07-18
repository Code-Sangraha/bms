import axios from "axios";
import { getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { SALES_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

export type SalesByCustomerApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  sales?: unknown;
  transactions?: unknown;
  error?: unknown;
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

/**
 * GET /v1/sales/get-by-customer with JSON body `{ customer }`.
 * Backend currently reads `req.body` for this GET route, so this uses axios.
 */
export async function fetchSalesByCustomer(
  customer: string
): Promise<
  { ok: true; data: SalesByCustomerApiResponse } | { ok: false; error: string; status: number }
> {
  const base = getBaseUrl();
  if (!base.trim()) {
    return { ok: false, error: "API base URL is not configured.", status: 0 };
  }

  const url = `${base}${SALES_ROUTES.GET_BY_CUSTOMER}`;
  const body = { customer };

  const requestWithToken = (token: string | null) =>
    axios.request<SalesByCustomerApiResponse>({
      method: "GET",
      url,
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

    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: errorMessageFromPayload(res.data), status: res.status };
    }

    const payload = res.data ?? {};
    if (payload.success === false) {
      return { ok: false, error: errorMessageFromPayload(payload), status: res.status };
    }

    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}
