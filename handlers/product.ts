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
  quantity?: number;
  weight?: number;
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
  quantity?: number;
  weight?: number;
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

export async function createProduct(
  payload: CreateProductFormValues,
  options?: { isProcessed?: boolean }
) {
  const body: CreateProductPayload = {
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    status: payload.status === "Active",
  };
  if (options?.isProcessed) {
    body.weight = Number(payload.quantity);
    body.quantity = Number(payload.quantity);
  }
  else body.quantity = Number(payload.quantity);
  if (payload.createdBy?.trim()) body.createdBy = payload.createdBy.trim();
  return apiRequest<CreateProductResponse>(PRODUCT_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  id: string,
  payload: CreateProductFormValues,
  options?: { isProcessed?: boolean }
) {
  const body: UpdateProductPayload = {
    id,
    name: payload.name.trim(),
    productTypeId: payload.productTypeId.trim(),
    outletId: payload.outletId.trim(),
    status: payload.status === "Active",
  };
  if (options?.isProcessed) {
    body.weight = Number(payload.quantity);
    body.quantity = Number(payload.quantity);
  }
  else body.quantity = Number(payload.quantity);
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
  productTypeId?: string;
  outletId: string;
  quantity?: number;
  weight?: number;
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

export type CreateLivestockItemPayload = {
  productId: string;
  name: string;
  itemId: string;
  weight: number;
  price: number;
  status: boolean;
};

export type LivestockItem = {
  id?: string;
  productId: string;
  name: string;
  itemId: string;
  weight: number;
  price: number;
  status: boolean;
  [key: string]: unknown;
};

export type CreateLivestockItemResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem;
  item?: LivestockItem;
  [key: string]: unknown;
};

export async function createLivestockItem(payload: CreateLivestockItemPayload) {
  return apiRequest<CreateLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_CREATE_ITEM, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type GetLivestockItemsByProductResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem[];
  items?: LivestockItem[];
  [key: string]: unknown;
};

export async function getLivestockItemsByProduct(
  productId: string
): Promise<
  | { ok: true; data: LivestockItem[] }
  | { ok: false; error: string; status: number }
> {
  // Backend endpoint supports query string GET in browser fetch environments.
  const getResult = await apiRequest<GetLivestockItemsByProductResponse>(
    `${PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT}?productId=${encodeURIComponent(productId)}`,
    {
      method: "GET",
    }
  );
  if (!getResult.ok) return getResult;
  const list = getResult.data?.data ?? getResult.data?.items ?? [];
  const data = Array.isArray(list)
    ? list.map((item) => ({
        ...item,
        productId: item.productId || productId,
      }))
    : [];
  return { ok: true, data };
}

export type UpdateLivestockItemPayload = {
  id: string;
  name: string;
  itemId: string;
  productId: string;
  weight: number;
  price: number;
  status: boolean;
};

export type UpdateLivestockItemResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem;
  item?: LivestockItem;
  [key: string]: unknown;
};

export async function updateLivestockItem(payload: UpdateLivestockItemPayload) {
  return apiRequest<UpdateLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_UPDATE_ITEM, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type DeleteLivestockItemPayload = {
  id: string;
};

export type DeleteLivestockItemResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function deleteLivestockItem(payload: DeleteLivestockItemPayload) {
  const encodedId = encodeURIComponent(payload.id);

  const attempts = [
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT, {
        method: "DELETE",
        body: JSON.stringify(payload),
      }),
    () =>
      apiRequest<DeleteLivestockItemResponse>(
        `${PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT}?id=${encodedId}`,
        {
          method: "DELETE",
        }
      ),
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT, {
        method: "DELETE",
        body: JSON.stringify({ livestockItemId: payload.id }),
      }),
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT, {
        method: "DELETE",
        body: JSON.stringify({ itemId: payload.id }),
      }),
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_GET_ITEMS_BY_PRODUCT, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_DELETE_ITEM, {
        method: "DELETE",
        body: JSON.stringify(payload),
      }),
    () =>
      apiRequest<DeleteLivestockItemResponse>(PRODUCT_ROUTES.LIVESTOCK_DELETE_ITEM, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  ];

  let lastError:
    | { ok: false; error: string; status: number }
    | null = null;

  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok) return result;
    lastError = result;
  }

  return (
    lastError ?? {
      ok: false,
      error: "Failed to delete live stock item",
      status: 500,
    }
  );
}
