import type { CreateRoleFormValues } from "@/schema/role";
import { apiRequest } from "@/lib/api/client";
import { ROLE_ROUTES } from "@/lib/api/routes";

export type Role = {
  id: string;
  name: string;
};

export type GetRolesResponse = {
  data?: Role[];
  roles?: Role[];
  [key: string]: unknown;
};

export async function getRoles(): Promise<
  | { ok: true; data: Role[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetRolesResponse>(ROLE_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.roles ?? [];
  const data: Role[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export type CreateRolePayload = {
  name: string;
};

export type CreateRoleResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function createRole(payload: CreateRoleFormValues) {
  const body: CreateRolePayload = {
    name: payload.name.trim(),
  };
  return apiRequest<CreateRoleResponse>(ROLE_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type UpdateRolePayload = {
  id: string;
  name: string;
};

export type UpdateRoleResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateRole(id: string, payload: CreateRoleFormValues) {
  const body: UpdateRolePayload = {
    id,
    name: payload.name.trim(),
  };
  return apiRequest<UpdateRoleResponse>(ROLE_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type DeleteRoleResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function deleteRole(id: string) {
  return apiRequest<DeleteRoleResponse>(ROLE_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
