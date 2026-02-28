import type { CreateEmployeeFormValues } from "@/schema/employee";
import { apiRequest } from "@/lib/api/client";
import { EMPLOYEE_ROUTES } from "@/lib/api/routes";

export type Employee = {
  id: string;
  employeeId: string;
  iot: string;
  name: string;
  departmentId: string;
  outletId: string;
  roleId: string;
  status: boolean;
  contact: string;
  email?: string;
  department?: { name: string } | string;
  role?: { name: string } | string;
  [key: string]: unknown;
};

export type GetEmployeesResponse = {
  data?: Employee[];
  employees?: Employee[];
  [key: string]: unknown;
};

export type CreateEmployeePayload = {
  employeeId: string;
  iot: string;
  name: string;
  departmentId: string;
  outletId: string;
  roleId: string;
  status: boolean;
  contact: string;
};

export type CreateEmployeeResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function getEmployees(): Promise<
  | { ok: true; data: Employee[] }
  | { ok: false; error: string; status: number }
> {
  const result = await apiRequest<GetEmployeesResponse>(EMPLOYEE_ROUTES.GET, {
    method: "GET",
  });
  if (!result.ok) return result;
  const list = result.data?.data ?? result.data?.employees ?? [];
  const data: Employee[] = Array.isArray(list) ? list : [];
  return { ok: true, data };
}

export async function createEmployee(payload: CreateEmployeeFormValues) {
  const body: CreateEmployeePayload = {
    employeeId: payload.employeeId.trim(),
    iot: payload.iot.trim(),
    name: payload.name.trim(),
    departmentId: payload.departmentId,
    outletId: payload.outletId,
    roleId: payload.roleId,
    status: payload.status === "Active",
    contact: payload.contact.trim(),
  };
  return apiRequest<CreateEmployeeResponse>(EMPLOYEE_ROUTES.CREATE, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
