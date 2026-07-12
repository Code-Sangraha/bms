import axios from "axios";
import type { CustomerFormValues } from "@/schema/customer";
import { apiRequest, getBaseUrl, tryRefresh } from "@/lib/api/client";
import { CUSTOMER_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";
import type { CustomerType } from "@/handlers/customerType";

export type Customer = {
  id: string;
  name: string;
  contact: string;
  outletId?: string;
  customerTypeId: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  customerType?: CustomerType;
};

export type GetCustomersResponse = {
  data?: Customer[];
  customers?: Customer[];
  [key: string]: unknown;
};

export type CreateCustomerPayload = {
  name: string;
  contact: string;
  outletId: string;
  customerTypeId: string;
  createdBy?: string;
};

export type UpdateCustomerPayload = {
  id: string;
  name: string;
  contact: string;
  outletId: string;
  customerTypeId: string;
  updatedBy?: string;
};

type CustomerMutationResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const msg = o.message ?? o.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return "Request failed.";
}

function parseCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" ? o.name : null;
  const contact = typeof o.contact === "string" ? o.contact : null;
  const outletId = typeof o.outletId === "string" ? o.outletId : undefined;
  const customerTypeId =
    typeof o.customerTypeId === "string" ? o.customerTypeId : null;
  if (!id || !name || !contact || !customerTypeId) return null;

  const customer: Customer = {
    id,
    name,
    contact,
    outletId,
    customerTypeId,
  };

  if (typeof o.createdAt === "string") customer.createdAt = o.createdAt;
  if (typeof o.updatedAt === "string") customer.updatedAt = o.updatedAt;
  if (typeof o.createdBy === "string") customer.createdBy = o.createdBy;
  if (typeof o.updatedBy === "string") customer.updatedBy = o.updatedBy;

  const ctRaw = o.customerType;
  if (ctRaw && typeof ctRaw === "object") {
    const ct = ctRaw as Record<string, unknown>;
    const ctId = typeof ct.id === "string" ? ct.id : customerTypeId;
    const ctName = typeof ct.name === "string" ? ct.name : "";
    const ctStatus = ct.status === true || ct.status === "true";
    customer.customerType = { id: ctId, name: ctName, status: ctStatus };
  }

  return customer;
}

export function parseCustomerForTest(raw: unknown): Customer | null {
  return parseCustomer(raw);
}

function normalizeCustomerList(data: GetCustomersResponse): Customer[] {
  const list = data?.data ?? data?.customers ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map(parseCustomer)
    .filter((c): c is Customer => c != null);
}

export async function getCustomers(
  outletId?: string | null
): Promise<
  | { ok: true; data: Customer[] }
  | { ok: false; error: string; status: number }
> {
  const trimmed = outletId?.trim();
  const route =
    trimmed && trimmed.length > 0
      ? `${CUSTOMER_ROUTES.GET}?outletId=${encodeURIComponent(trimmed)}`
      : CUSTOMER_ROUTES.GET;

  const result = await apiRequest<GetCustomersResponse>(route, { method: "GET" });
  if (!result.ok) return result;
  return { ok: true, data: normalizeCustomerList(result.data) };
}

/**
 * GET /v1/customers/get-by-id with JSON body `{ id }` (axios — fetch cannot attach GET body).
 */
export async function getCustomerById(
  id: string
): Promise<
  | { ok: true; data: Customer }
  | { ok: false; error: string; status: number }
> {
  const base = getBaseUrl();
  if (!base.trim()) {
    return { ok: false, error: "API base URL is not configured.", status: 0 };
  }

  const url = `${base}${CUSTOMER_ROUTES.GET_BY_ID}`;
  const body = { id };

  const requestWithToken = (token: string | null) =>
    axios.request<GetCustomersResponse>({
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
    let token = getAuthToken();
    let res = await requestWithToken(token);

    if (res.status === 401) {
      const newToken = await tryRefresh();
      if (newToken) {
        token = newToken;
        res = await requestWithToken(token);
      } else {
        clearAuthToken();
        clearStoredUser();
      }
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

    const raw =
      payload.data ??
      (Array.isArray(payload.customers) ? payload.customers[0] : payload);
    const customer = parseCustomer(raw);
    if (!customer) {
      return { ok: false, error: "Customer not found.", status: 404 };
    }
    return { ok: true, data: customer };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

export async function createCustomer(payload: CustomerFormValues) {
  const body: CreateCustomerPayload = {
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    customerTypeId: payload.customerTypeId.trim(),
  };
  return apiRequest<CustomerMutationResponse>(CUSTOMER_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCustomer(id: string, payload: CustomerFormValues) {
  const body: UpdateCustomerPayload = {
    id,
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    customerTypeId: payload.customerTypeId.trim(),
  };
  return apiRequest<CustomerMutationResponse>(CUSTOMER_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteCustomer(id: string) {
  return apiRequest<CustomerMutationResponse>(CUSTOMER_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
