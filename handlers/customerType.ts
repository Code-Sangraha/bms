import type { CreateCustomerTypeFormValues } from "@/schema/customerType";
import { apiRequest } from "@/lib/api/client";
import { CUSTOMER_TYPE_ROUTES } from "@/lib/api/routes";

export type CustomerType = {
  id: string;
  name: string;
  status: boolean;
};

export type GetCustomerTypesResponse = {
  data?: CustomerType[];
  customerTypes?: CustomerType[];
  [key: string]: unknown;
};

export type CreateCustomerTypePayload = {
  name: string;
  status: boolean;
};

export type CreateCustomerTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type UpdateCustomerTypePayload = {
  id: string;
  name: string;
  status: boolean;
};

export type UpdateCustomerTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DeleteCustomerTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getCustomerTypes(): Promise<
  | { ok: true; data: CustomerType[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetCustomerTypesResponse>(
    CUSTOMER_TYPE_ROUTES.GET,
    { method: "GET" }
  );
  if (!result.ok) return result;
  const list =
    result.data?.data ?? result.data?.customerTypes ?? [];
  const data: CustomerType[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createCustomerType(
  payload: CreateCustomerTypeFormValues
) {
  const body: CreateCustomerTypePayload = {
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<CreateCustomerTypeResponse>(
    CUSTOMER_TYPE_ROUTES.CREATE,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function updateCustomerType(
  id: string,
  payload: CreateCustomerTypeFormValues
) {
  const body: UpdateCustomerTypePayload = {
    id,
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<UpdateCustomerTypeResponse>(
    CUSTOMER_TYPE_ROUTES.UPDATE,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function deleteCustomerType(id: string) {
  return apiRequest<DeleteCustomerTypeResponse>(
    CUSTOMER_TYPE_ROUTES.DELETE,
    {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }
  );
}
