import { apiRequest } from "@/lib/api/client";
import { LIVESTOCK_ROUTES } from "@/lib/api/routes";

export type LivestockItem = {
  id: string;
  productId: string;
  name: string;
  itemId: string;
  weight: number;
  price: number;
  status: boolean;
  outletId?: string;
  [key: string]: unknown;
};

export type CreateLivestockItemPayload = {
  productId: string;
  name: string;
  itemId: string;
  outletId?: string;
  weight: number;
  price: number;
  status: boolean;
};

export type CreateLivestockItemResponse = {
  success?: boolean;
  message?: string;
  data?: LivestockItem;
  [key: string]: unknown;
};

export type GetLivestockItemsResponse = {
  data?: LivestockItem[];
  items?: LivestockItem[];
  [key: string]: unknown;
};

export async function createLivestockItem(
  payload: CreateLivestockItemPayload
) {
  const body: CreateLivestockItemPayload = {
    productId: payload.productId.trim(),
    name: payload.name.trim(),
    itemId: payload.itemId.trim(),
    weight: Number(payload.weight),
    price: Number(payload.price),
    status: payload.status,
  };

  // Only add outletId if it exists and has a value
  if (payload.outletId && payload.outletId.trim() !== "") {
    body.outletId = payload.outletId.trim();
  }

  return apiRequest<CreateLivestockItemResponse>(LIVESTOCK_ROUTES.CREATE_ITEM, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getLivestockItems() {
  const result = await apiRequest<GetLivestockItemsResponse>(
    LIVESTOCK_ROUTES.GET_ITEMS,
    {
      method: "GET",
    }
  );
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.items ?? [];
  const data: LivestockItem[] = Array.isArray(list) ? list : [];
  return { ok: true as const, data };
}
