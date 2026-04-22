import { apiRequest } from "@/lib/api/client";
import { PROCESSING_PLANT_ROUTES } from "@/lib/api/routes";

/**
 * Processing plant record. Backend should associate each plant with an `outletId`
 * so scoped navigation (`?outletId=`) can filter sales, inventory, and attendance.
 */
export type ProcessingPlant = {
  id: string;
  name: string;
  userId: string;
  contact: string;
  status: boolean;
  /** Outlet used for sales/inventory scope when operating as this plant (from API). */
  outletId: string | null;
  [key: string]: unknown;
};

type RawProcessingPlant = {
  id?: string;
  name?: string;
  userId?: string;
  contact?: string;
  status?: boolean;
  outletId?: string;
  [key: string]: unknown;
};

type GetProcessingPlantsResponse = {
  data?: RawProcessingPlant[];
  processingPlants?: RawProcessingPlant[];
  [key: string]: unknown;
};

type CreateProcessingPlantPayload = {
  name: string;
  userId: string;
  contact: string;
  status: boolean;
};

type CreateProcessingPlantResponse = {
  success?: boolean;
  message?: string;
  data?: RawProcessingPlant;
  processingPlant?: RawProcessingPlant;
  [key: string]: unknown;
};

function normalizeProcessingPlant(item: RawProcessingPlant): ProcessingPlant | null {
  if (!item.id || !item.name) return null;
  const outletRaw = item.outletId;
  const outletId =
    typeof outletRaw === "string" && outletRaw.trim() !== "" ? outletRaw.trim() : null;
  return {
    id: item.id,
    name: item.name,
    userId: item.userId ?? "",
    contact: item.contact ?? "",
    status: Boolean(item.status),
    outletId,
  };
}

export async function getProcessingPlants(): Promise<
  | { ok: true; data: ProcessingPlant[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetProcessingPlantsResponse>(PROCESSING_PLANT_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.processingPlants ?? [];
  const data = Array.isArray(list)
    ? list
        .map(normalizeProcessingPlant)
        .filter((item): item is ProcessingPlant => item !== null)
    : [];
  return { ok: true, data };
}

export async function createProcessingPlant(payload: CreateProcessingPlantPayload) {
  return apiRequest<CreateProcessingPlantResponse>(PROCESSING_PLANT_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

