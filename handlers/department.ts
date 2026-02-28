import type { CreateDepartmentFormValues } from "@/schema/department";
import { apiRequest } from "@/lib/api/client";
import { DEPARTMENT_ROUTES } from "@/lib/api/routes";

export type Department = {
  id: string;
  name: string;
  status: boolean;
};

export type GetDepartmentsResponse = {
  data?: Department[];
  departments?: Department[];
  [key: string]: unknown;
};

export type CreateDepartmentPayload = {
  name: string;
  status: boolean;
};

export type CreateDepartmentResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getDepartments(): Promise<
  | { ok: true; data: Department[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetDepartmentsResponse>(DEPARTMENT_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.departments ?? [];
  const data: Department[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createDepartment(payload: CreateDepartmentFormValues) {
  const body: CreateDepartmentPayload = {
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<CreateDepartmentResponse>(DEPARTMENT_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type UpdateDepartmentPayload = {
  id: string;
  name: string;
  status: boolean;
};

export type UpdateDepartmentResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateDepartment(
  id: string,
  payload: CreateDepartmentFormValues
) {
  const body: UpdateDepartmentPayload = {
    id,
    name: payload.name.trim(),
    status: payload.status === "Active",
  };
  return apiRequest<UpdateDepartmentResponse>(DEPARTMENT_ROUTES.UPDATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type DeleteDepartmentResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function deleteDepartment(id: string) {
  return apiRequest<DeleteDepartmentResponse>(DEPARTMENT_ROUTES.DELETE, {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
