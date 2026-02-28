/**
 * API route constants. Use these vars instead of hardcoding paths.
 */

export const AUTH_ROUTES = {
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
} as const;

export const OUTLET_ROUTES = {
  GET: "/outlets/get",
  CREATE: "/outlets/create",
  UPDATE: "/outlets/update",
  DELETE: "/outlets/delete",
} as const;

export const DEPARTMENT_ROUTES = {
  GET: "/departments/get",
  CREATE: "/departments/create",
  UPDATE: "/departments/update",
  DELETE: "/departments/delete",
} as const;

export const PRODUCT_TYPE_ROUTES = {
  GET: "/product-types/get",
  CREATE: "/product-types/create",
  UPDATE: "/product-types/update",
  DELETE: "/product-types/delete",
} as const;

export const PRODUCT_ROUTES = {
  GET: "/products/get",
  CREATE: "/products/create",
  UPDATE: "/products/update",
  DELETE: "/products/delete",
  RESTOCK: "/products/restock",
  DEDUCT: "/products/deduct",
} as const;

export const ROLE_ROUTES = {
  GET: "/roles/get",
  CREATE: "/roles/create",
  UPDATE: "/roles/update",
  DELETE: "/roles/delete",
} as const;

export const USER_ROUTES = {
  GET: "/users/get",
  CREATE: "/users/create",
} as const;

export const DUAL_PRICING_ROUTES = {
  GET: "/dual-pricing/get",
  CREATE: "/dual-pricing/create",
  UPDATE: "/dual-pricing/update",
  DELETE: "/dual-pricing/delete",
} as const;

export const EMPLOYEE_ROUTES = {
  GET: "/employees/get",
  CREATE: "/employees/create",
} as const;

export const ATTENDANCE_ROUTES = {
  CLOCK_IN: "/attendances/clock-in",
  CLOCK_OUT: "/attendances/clock-out",
} as const;

export const SALES_ROUTES = {
  GET: "/sales/get",
  GET_BY_PRODUCT_ID: "/sales/get-by-product-id",
  CREATE: "/sales/create",
  DASHBOARD_SALES: "/sales/dashboardSales",
} as const;

export const CUSTOMER_TYPE_ROUTES = {
  GET: "/customer-types/get",
  CREATE: "/customer-types/create",
  UPDATE: "/customer-types/update",
  DELETE: "/customer-types/delete",
} as const;
