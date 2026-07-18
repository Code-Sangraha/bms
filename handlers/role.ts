import type { CreateRoleFormValues } from "@/schema/role";
import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import { ROLE_ROUTES } from "@/lib/api/routes";
import type { ApiResponse } from "@/lib/api/types";

export type RolePermission = {
  id: string;
  name: string;
};

export type Role = {
  id: string;
  name: string;
  permissions: RolePermission[];
  permissionIds: string[];
};

type RoleListResponse = Partial<ApiResponse<unknown>> & {
  roles?: unknown;
};

type PermissionListResponse = Partial<ApiResponse<unknown>> & {
  permissions?: unknown;
};

function normalizePermission(raw: unknown): RolePermission | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return { id: row.id, name: row.name };
}

export function normalizeRole(raw: unknown): Role | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const permissions = Array.isArray(row.permissions)
    ? row.permissions
        .map(normalizePermission)
        .filter((permission): permission is RolePermission => permission !== null)
    : [];
  const embeddedIds = Array.isArray(row.permissionIds)
    ? row.permissionIds.filter((id): id is string => typeof id === "string")
    : [];
  const permissionIds = [...new Set(embeddedIds.length > 0 ? embeddedIds : permissions.map((p) => p.id))];
  return { id: row.id, name: row.name, permissions, permissionIds };
}

function responseFailure(data: { success?: boolean; message?: string; error?: unknown }) {
  if (data.success !== false) return null;
  return { ok: false as const, error: getApiErrorMessage(data), status: 400 };
}

export async function getRoles(): Promise<
  | { ok: true; data: Role[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<RoleListResponse>(ROLE_ROUTES.GET, { method: "GET" });
  if (!result.ok) return result;
  const failure = responseFailure(result.data);
  if (failure) return failure;
  const list = result.data.data ?? result.data.roles ?? [];
  const data = Array.isArray(list)
    ? list.map(normalizeRole).filter((role): role is Role => role !== null)
    : [];
  return { ok: true, data };
}

export async function getPermissions(): Promise<
  | { ok: true; data: RolePermission[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<PermissionListResponse>(ROLE_ROUTES.PERMISSIONS, {
    method: "GET",
  });
  if (!result.ok) return result;
  const failure = responseFailure(result.data);
  if (failure) return failure;
  const list = result.data.data ?? result.data.permissions ?? [];
  const data = Array.isArray(list)
    ? list
        .map(normalizePermission)
        .filter((permission): permission is RolePermission => permission !== null)
    : [];
  return { ok: true, data };
}

async function roleMutation<T extends { success?: boolean; message?: string; error?: unknown }>(
  route: string,
  options: RequestInit
) {
  const result = await apiRequest<T>(route, options);
  if (!result.ok) return result;
  const failure = responseFailure(result.data);
  return failure ?? result;
}
export type CreateRolePayload = { name: string };
export type CreateRoleResponse = Partial<ApiResponse<unknown>>;

export async function createRole(payload: CreateRoleFormValues) {
  const body: CreateRolePayload = { name: payload.name.trim() };
  return roleMutation<CreateRoleResponse>(ROLE_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type UpdateRolePayload = { id: string; name: string };
export type UpdateRoleResponse = Partial<ApiResponse<unknown>>;

export async function updateRole(id: string, payload: CreateRoleFormValues) {
  const body: UpdateRolePayload = { id, name: payload.name.trim() };
  return roleMutation<UpdateRoleResponse>(ROLE_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type DeleteRoleResponse = Partial<ApiResponse<unknown>>;

export async function deleteRole(id: string) {
  return roleMutation<DeleteRoleResponse>(ROLE_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

export type UpdateRolePermissionsPayload = {
  roleId: string;
  permissionIds: string[];
};

export type UpdateRolePermissionsData = {
  roleId: string;
  permissionIds: string[];
};

export type UpdateRolePermissionsResponse = Partial<ApiResponse<UpdateRolePermissionsData>>;

export async function updateRolePermissions(payload: UpdateRolePermissionsPayload) {
  return roleMutation<UpdateRolePermissionsResponse>(ROLE_ROUTES.UPDATE_PERMISSIONS, {
    method: "POST",
    body: JSON.stringify({
      roleId: payload.roleId,
      permissionIds: [...new Set(payload.permissionIds)],
    }),
  });
}