import type { CreateOutletFormValues } from "@/schema/outlet";
import { apiRequest } from "@/lib/api/client";
import { OUTLET_ROUTES } from "@/lib/api/routes";

export type Outlet = {
  id: string;
  name: string;
  managerId: string;
  contact: string;
  status: boolean;
};

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
