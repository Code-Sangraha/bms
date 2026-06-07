import type { CreateOutletFormValues } from "@/schema/outlet";
import { apiRequest } from "@/lib/api/client";
import {
  getOutletExpenses,
  type OutletExpenseEntry,
  type OutletExpenseFilters,
  type OutletExpensePaymentStatus,
} from "@/lib/api/outletExpenses";
import { OUTLET_ROUTES } from "@/lib/api/routes";

export type {
  OutletExpenseEntry,
  OutletExpenseFilters,
  OutletExpensePaymentStatus,
};
export { getOutletExpenses };

export type Outlet = {
  id: string;
  name: string;
  managerId: string;
  contact: string;
  status: boolean;
};

/** Main outlet by display name (case-insensitive). Matches processing-plant / Highland defaults. */
export function getMainOutlet(outlets: Outlet[]): Outlet | null {
  return outlets.find((o) => o.name.trim().toLowerCase() === "main outlet") ?? null;
}

export function getMainOutletId(outlets: Outlet[]): string | null {
  return getMainOutlet(outlets)?.id ?? null;
}

function parentOutletIdFromRow(o: Outlet): string | null {
  const r = o as Outlet & Record<string, unknown>;
  const raw = r.parentOutletId ?? r.parent_outlet_id;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * Sub-outlets for Highland scope: when the API sets `parentOutletId` / `parent_outlet_id`,
 * returns outlets whose parent is the organization main outlet. Otherwise returns every
 * outlet except the one named "Main Outlet" (case-insensitive), matching outlet-management
 * and processing-plant main-outlet detection.
 */
export function getSubOutletsForScope(outlets: Outlet[]): Outlet[] {
  if (outlets.length === 0) return [];
  const main = getMainOutlet(outlets);
  const withParent = outlets.filter((o) => parentOutletIdFromRow(o) != null);
  if (withParent.length > 0 && main) {
    return outlets.filter((o) => {
      const pid = parentOutletIdFromRow(o);
      return pid === main.id;
    });
  }
  if (main) return outlets.filter((o) => o.id !== main.id);
  return [];
}

export type GetOutletsResponse = {
  data?: Outlet[];
  outlets?: Outlet[];
  [key: string]: unknown;
};

export type CreateOutletPayload = {
  name: string;
  managerId: string;
  contact: string;
  status: boolean;
};

export type CreateOutletResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getOutlets(): Promise<
  | { ok: true; data: Outlet[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetOutletsResponse>(OUTLET_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.outlets ?? [];
  const data: Outlet[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createOutlet(payload: CreateOutletFormValues) {
  const body: CreateOutletPayload = {
    name: payload.name.trim(),
    managerId: payload.managerId.trim(),
    contact: payload.contact.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<CreateOutletResponse>(OUTLET_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type UpdateOutletPayload = {
  id: string;
  name: string;
  contact: string;
  status: boolean;
  /** When reassigned; backend updates outlet.managerId only — callers should sync User.outletId via users/update. */
  managerId?: string;
};

export type UpdateOutletResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateOutlet(payload: UpdateOutletPayload) {
  return apiRequest<UpdateOutletResponse>(OUTLET_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type DeleteOutletResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function deleteOutlet(id: string) {
  return apiRequest<DeleteOutletResponse>(OUTLET_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
