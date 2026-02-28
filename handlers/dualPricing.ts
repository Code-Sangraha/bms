import type { DualPricingFormValues } from "@/schema/dualPricing";
import { apiRequest } from "@/lib/api/client";
import { DUAL_PRICING_ROUTES } from "@/lib/api/routes";

export type DualPricing = {
  id: string;
  productId: string;
  wholesalePrice: number;
  retailPrice: number;
  outletId: string;
  status: boolean;
  product?: { name: string } | string;
  outlet?: { name: string } | string;
  [key: string]: unknown;
};

export type GetDualPricingsResponse = {
  data?: DualPricing[];
  dualPricings?: DualPricing[];
  [key: string]: unknown;
};

export async function getDualPricings(): Promise<
  | { ok: true; data: DualPricing[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetDualPricingsResponse>(
    DUAL_PRICING_ROUTES.GET,
    { method: "GET" }
  );
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.dualPricings ?? [];
  const data: DualPricing[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export type CreateDualPricingPayload = {
  productId: string;
  wholesalePrice: number;
  retailPrice: number;
  outletId: string;
  status: boolean;
};

export type CreateDualPricingResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function createDualPricing(payload: DualPricingFormValues) {
  const body: CreateDualPricingPayload = {
    productId: payload.productId,
    wholesalePrice: Number(payload.wholesalePrice),
    retailPrice: Number(payload.retailPrice),
    outletId: payload.outletId,
    status: payload.status === "Active",
  };
  return apiRequest<CreateDualPricingResponse>(DUAL_PRICING_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type UpdateDualPricingPayload = {
  id: string;
  productId: string;
  wholesalePrice: number;
  retailPrice: number;
  outletId: string;
  status: boolean;
};

export type UpdateDualPricingResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateDualPricing(
  id: string,
  payload: DualPricingFormValues
) {
  const body: UpdateDualPricingPayload = {
    id,
    productId: payload.productId,
    wholesalePrice: Number(payload.wholesalePrice),
    retailPrice: Number(payload.retailPrice),
    outletId: payload.outletId,
    status: payload.status === "Active",
  };
  return apiRequest<UpdateDualPricingResponse>(DUAL_PRICING_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type DeleteDualPricingResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function deleteDualPricing(id: string) {
  return apiRequest<DeleteDualPricingResponse>(DUAL_PRICING_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
