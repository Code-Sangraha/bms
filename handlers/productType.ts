import type { CreateProductTypeFormValues } from "../schema/productType";
import { apiRequest } from "@/lib/api/client";
import { PRODUCT_TYPE_ROUTES } from "@/lib/api/routes";

export type ProductType = {
  id: string;
  name: string;
  status: boolean;
};

export type GetProductTypesResponse = {
  data?: ProductType[];
  productTypes?: ProductType[];
  [key: string]: unknown;
};

export type CreateProductTypePayload = {
  name: string;
  status: boolean;
};

export type CreateProductTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type UpdateProductTypePayload = {
  id: string;
  name: string;
  status: boolean;
};

export type UpdateProductTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DeleteProductTypeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getProductTypes(): Promise<
  | { ok: true; data: ProductType[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetProductTypesResponse>(
    PRODUCT_TYPE_ROUTES.GET,
    { method: "GET" }
  );
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.productTypes ?? [];
  const data: ProductType[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createProductType(
  payload: CreateProductTypeFormValues
) {
  const body: CreateProductTypePayload = {
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<CreateProductTypeResponse>(PRODUCT_TYPE_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProductType(
  id: string,
  payload: CreateProductTypeFormValues
) {
  const body: UpdateProductTypePayload = {
    id,
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<UpdateProductTypeResponse>(PRODUCT_TYPE_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteProductType(id: string) {
  return apiRequest<DeleteProductTypeResponse>(PRODUCT_TYPE_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
