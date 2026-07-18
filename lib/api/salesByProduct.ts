import axios from "axios";
import { getApiErrorMessage, getBaseUrl, retryAfterUnauthorized } from "@/lib/api/client";
import { SALES_ROUTES } from "@/lib/api/routes";
import { getAuthToken } from "@/lib/auth/token";

/** Matches unified API envelope + nested sales list shapes. */
export type SalesByProductApiResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
  sales?: unknown;
  transactions?: unknown;
  /** Zod validation failures often return `{ path, message }[]` here. */
  error?: unknown;
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  return getApiErrorMessage(data);
}

/**
 * GET /v1/sales/get-by-product-id
 *
 * Backend: `validateRequest` + handler read **only `req.body`**, not `req.query`. A plain GET
 * with no JSON body yields Zod `productId` Required. Query `?productId=` is ignored until the
 * API merges query into the validated object.
 *
 * Client: **GET with JSON body** `{ productId }` + `Content-Type: application/json` via axios
 * (browser `fetch` cannot attach a GET body). Same pattern as `getLivestockInventoryHistory`.
 * Success responses may use HTTP **201**.
 */
export async function fetchSalesByProductId(
  productId: string
): Promise<
  { ok: true; data: SalesByProductApiResponse } | { ok: false; error: string; status: number }
> {
  const base = getBaseUrl();
  if (!base.trim()) {
    return { ok: false, error: "API base URL is not configured.", status: 0 };
  }

  const url = `${base}${SALES_ROUTES.GET_BY_PRODUCT_ID}`;
  const body = { productId };

  const requestWithToken = (token: string | null) =>
    axios.request<SalesByProductApiResponse>({
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

    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}
