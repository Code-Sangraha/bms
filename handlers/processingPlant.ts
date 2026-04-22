import { apiRequest } from "@/lib/api/client";
import { PROCESSING_PLANT_ROUTES } from "@/lib/api/routes";
import type { User } from "@/handlers/user";

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
  user_id?: string;
  user?: { id?: unknown; outletId?: unknown; outlet_id?: unknown; outlet?: unknown };
  contact?: string;
  status?: boolean;
  outletId?: string;
  outlet_id?: string;
  outlet?: { id?: string } | string;
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

function coerceIdString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Reads outlet id from a loose API row (plant, user, or nested `user`). */
function outletIdFromLooseRecord(row: Record<string, unknown>): string | null {
  const direct =
    coerceIdString(row.outletId) ??
    coerceIdString(row.outlet_id) ??
    coerceIdString(row.outletID);
  if (direct) return direct;

  const outlet = row.outlet;
  if (outlet && typeof outlet === "object" && outlet !== null && "id" in outlet) {
    const id = coerceIdString((outlet as { id?: unknown }).id);
    if (id) return id;
  }
  if (typeof outlet === "string" || typeof outlet === "number") {
    return coerceIdString(outlet);
  }

  return null;
}

function extractOutletIdFromRaw(item: RawProcessingPlant): string | null {
  const row = item as Record<string, unknown>;
  const fromRow = outletIdFromLooseRecord(row);
  if (fromRow) return fromRow;

  const user = row.user;
  if (user && typeof user === "object" && user !== null) {
    const fromUser = outletIdFromLooseRecord(user as Record<string, unknown>);
    if (fromUser) return fromUser;
  }

  return null;
}

function pickAssignedUserId(item: RawProcessingPlant): string {
  const row = item as Record<string, unknown>;
  const fromFields =
    coerceIdString(row.userId) ??
    coerceIdString(row.user_id) ??
    coerceIdString(row.assignedUserId) ??
    coerceIdString(row.assigned_user_id);
  if (fromFields) return fromFields;

  const u = row.user;
  if (u && typeof u === "object" && u !== null && "id" in u) {
    const nested = coerceIdString((u as { id?: unknown }).id);
    if (nested) return nested;
  }
  return "";
}

function normalizeProcessingPlant(item: RawProcessingPlant): ProcessingPlant | null {
  const id = coerceIdString(item.id);
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    userId: pickAssignedUserId(item),
    contact: item.contact ?? "",
    status: Boolean(item.status),
    outletId: extractOutletIdFromRaw(item),
  };
}

/**
 * When the API omits `outletId` on a plant, use the assigned user's `outletId` so
 * scoped navigation still works (same outlet the manager/staff is tied to).
 */
export function mergeProcessingPlantOutletFromUsers(
  plants: ProcessingPlant[],
  users: User[]
): ProcessingPlant[] {
  const outletByUserId = new Map<string, string>();
  for (const u of users) {
    const uid = coerceIdString(u.id);
    const oid = outletIdFromLooseRecord(u as unknown as Record<string, unknown>);
    if (uid && oid) outletByUserId.set(uid, oid);
  }
  return plants.map((p) => {
    const uid = (p.userId ?? "").trim();
    const fromUser = uid !== "" ? outletByUserId.get(uid) ?? null : null;
    // Last resort: row `id` is the outlet id when the API omits `outletId` and the user has none.
    return {
      ...p,
      outletId: p.outletId ?? fromUser ?? p.id,
    };
  });
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

