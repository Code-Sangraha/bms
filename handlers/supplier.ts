import axios from "axios";
import type { SupplierFormValues } from "@/schema/supplier";
import { apiRequest, getBaseUrl, tryRefresh } from "@/lib/api/client";
import { SUPPLIER_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  outletId: string | null;
  status: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateSupplierPayload = SupplierFormValues & { createdBy?: string };
export type UpdateSupplierPayload = SupplierFormValues & { id: string; updatedBy?: string };

export type SupplierResponse = {
  success?: boolean;
  message?: string;
  data?: Supplier | Supplier[] | null;
  suppliers?: Supplier[];
  [key: string]: unknown;
};

function errorMessageFromPayload(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed.";
  const row = data as Record<string, unknown>;
  const message = row.message ?? row.error;
  return typeof message === "string" && message.trim() ? message.trim() : "Request failed.";
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

export function normalizeSupplier(raw: unknown): Supplier | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    contact: stringOrNull(row.contact),
    outletId: stringOrNull(row.outletId),
    status: row.status === true || row.status === "true",
    createdBy: stringOrNull(row.createdBy),
    updatedBy: stringOrNull(row.updatedBy),
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
    deletedAt: stringOrNull(row.deletedAt),
  };
}

function failedResponse(data: SupplierResponse): { ok: false; error: string; status: number } | null {
  if (data.success !== false) return null;
  return { ok: false, error: errorMessageFromPayload(data), status: 400 };
}

export async function getSuppliers(
  outletId?: string | null
): Promise<{ ok: true; data: Supplier[] } | { ok: false; error: string; status: number }> {
  const trimmed = outletId?.trim();
  const route = trimmed
    ? SUPPLIER_ROUTES.GET + "?outletId=" + encodeURIComponent(trimmed)
    : SUPPLIER_ROUTES.GET;
  const result = await apiRequest<SupplierResponse>(route, { method: "GET" });
  if (!result.ok) return result;
  const failure = failedResponse(result.data);
  if (failure) return failure;
  const list = Array.isArray(result.data.data)
    ? result.data.data
    : Array.isArray(result.data.suppliers)
      ? result.data.suppliers
      : [];
  return { ok: true, data: list.map(normalizeSupplier).filter((x): x is Supplier => x !== null) };
}

export async function getSupplierById(
  id: string
): Promise<{ ok: true; data: Supplier } | { ok: false; error: string; status: number }> {
  const base = getBaseUrl();
  if (!base.trim()) return { ok: false, error: "API base URL is not configured.", status: 0 };

  const requestWithToken = (token: string | null) =>
    axios.request<SupplierResponse>({
      method: "GET",
      url: base + SUPPLIER_ROUTES.GET_BY_ID,
      data: { id },
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      withCredentials: true,
      validateStatus: () => true,
    });

  try {
    let token = getAuthToken();
    let response = await requestWithToken(token);
    if (response.status === 401) {
      const nextToken = await tryRefresh();
      if (nextToken) {
        token = nextToken;
        response = await requestWithToken(token);
      } else {
        clearAuthToken();
        clearStoredUser();
      }
    }
    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: errorMessageFromPayload(response.data), status: response.status };
    }
    const failure = failedResponse(response.data);
    if (failure) return failure;
    const supplier = normalizeSupplier(response.data.data);
    return supplier ? { ok: true, data: supplier } : { ok: false, error: "Supplier not found", status: 400 };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

export async function createSupplier(payload: CreateSupplierPayload) {
  const body: CreateSupplierPayload = {
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    ...(payload.createdBy ? { createdBy: payload.createdBy } : {}),
  };
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok || result.data.success !== false) return result;
  return failedResponse(result.data);
}

export async function updateSupplier(payload: UpdateSupplierPayload) {
  const body: UpdateSupplierPayload = {
    id: payload.id,
    name: payload.name.trim(),
    contact: payload.contact.trim(),
    outletId: payload.outletId.trim(),
    ...(payload.updatedBy ? { updatedBy: payload.updatedBy } : {}),
  };
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok || result.data.success !== false) return result;
  return failedResponse(result.data);
}

export async function deleteSupplier(id: string) {
  const result = await apiRequest<SupplierResponse>(SUPPLIER_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  if (!result.ok || result.data.success !== false) return result;
  return failedResponse(result.data);
}
