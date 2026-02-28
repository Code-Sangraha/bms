import type { CreateUserFormValues } from "@/schema/user";
import { apiRequest } from "@/lib/api/client";
import { USER_ROUTES } from "@/lib/api/routes";

export type User = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  /** API may return role as string or as object { name: string } */
  role?: string | { name: string };
  outletId?: string;
  status: boolean;
  [key: string]: unknown;
};

export type GetUsersResponse = {
  data?: User[];
  users?: User[];
  [key: string]: unknown;
};

export async function getUsers(): Promise<
  | { ok: true; data: User[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetUsersResponse>(USER_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.users ?? [];
  const data: User[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export type CreateUserPayload = {
  fullName: string;
  roleId: string;
  status: boolean;
  email: string;
  contact?: string;
};

export type CreateUserResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function createUser(payload: CreateUserFormValues) {
  const body: CreateUserPayload = {
    fullName: payload.fullName.trim(),
    roleId: payload.roleId,
    status: payload.status === "Active",
    email: payload.email.trim().toLowerCase(),
  };
  if (payload.contact?.trim()) body.contact = payload.contact.trim();
  return apiRequest<CreateUserResponse>(USER_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
