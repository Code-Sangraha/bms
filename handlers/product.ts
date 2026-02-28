import type { CreateProductFormValues } from "@/schema/product";
import { apiRequest } from "@/lib/api/client";
import { PRODUCT_ROUTES } from "@/lib/api/routes";

export type Product = {
  id: string;
  name: string;
  productTypeId: string;
  outletId: string;
  quantity: number;
  status: boolean;
  createdBy?: string;
  productType?: { id?: string; name?: string };
  outlet?: { id?: string; name?: string };
  weight?: number | null;
  stockStatus?: string;
  [key: string]: unknown;
};

export type GetProductsResponse = {
  data?: Product[];
  products?: Product[];
  [key: string]: unknown;
};

export type CreateProductPayload = {
  name: string;
  productTypeId: string;
  outletId: string;
  quantity: number;
  status: boolean;
  createdBy?: string;
};

export type CreateProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type UpdateProductPayload = {
  id: string;
  name: string;
  productTypeId: string;
  outletId: string;
  quantity: number;
  status: boolean;
  createdBy?: string;
};

export type UpdateProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type DeleteProductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getProducts(): Promise<
  | { ok: true; data: Product[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetProductsResponse>(PRODUCT_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.products ?? [];
  const data: Product[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createProduct(payload: CreateProductFormValues) {
  const body: CreateProductPayload = {
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    quantity: Number(payload.quantity),
    status: payload.status === "Active",
  };
  if (payload.createdBy?.trim()) body.createdBy = payload.createdBy.trim();
  return apiRequest<CreateProductResponse>(PRODUCT_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  id: string,
  payload: CreateProductFormValues
) {
  const body: UpdateProductPayload = {
    id,
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    quantity: Number(payload.quantity),
    status: payload.status === "Active",
  };
  if (payload.createdBy?.trim()) body.createdBy = payload.createdBy.trim();
  return apiRequest<UpdateProductResponse>(PRODUCT_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id: string) {
  return apiRequest<DeleteProductResponse>(PRODUCT_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

export type RestockDeductPayload = {
  id: string;
  productTypeId: string;
  outletId: string;
  quantity: number;
};

export type RestockDeductResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function restockProduct(payload: RestockDeductPayload) {
  return apiRequest<RestockDeductResponse>(PRODUCT_ROUTES.RESTOCK, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deductProduct(payload: RestockDeductPayload) {
  return apiRequest<RestockDeductResponse>(PRODUCT_ROUTES.DEDUCT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
