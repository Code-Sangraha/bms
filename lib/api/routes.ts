/**
 * API route constants. Use these vars instead of hardcoding paths.
 */

export const AUTH_ROUTES = {
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  REFRESH: "/auth/refresh",
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
  LIVESTOCK_CREATE_CATEGORY: "/products/livestock/create-category",
  LIVESTOCK_GET_CATEGORY: "/products/livestock/get-category",
  LIVESTOCK_CREATE_ITEM: "/products/livestock/create-item",
  LIVESTOCK_GET_ITEMS_BY_PRODUCT: "/products/livestock/get-items-by-product",
  LIVESTOCK_RESTOCK: "/products/livestock/restock",
  LIVESTOCK_DEDUCT: "/products/livestock/deduct",
  LIVESTOCK_UPDATE_ITEM: "/products/livestock/update-item",
  LIVESTOCK_DELETE_ITEM: "/products/livestock/delete-item",
  /** GET ?livestockItemId= — waste / consumption lines for a live stock row (placeholder until backend exists) */
  LIVESTOCK_WASTE_HISTORY: "/products/livestock/waste-history",
  LIVESTOCK_SEND_TO_PROCESSING: "/products/livestock/send-to-processing",
  LIVESTOCK_COMPLETE_PROCESSING: "/products/livestock/complete-processing",
  LIVESTOCK_GET_PENDING_PROCESSING: "/products/livestock/get-pending-processing",
  /** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — placeholder until backend matches doc shape */
  LIVESTOCK_OPENING_STOCK: "/products/livestock/opening-stock",
  /** GET ?from=&to= — processed products opening/closing stock (same payload shape as livestock) */
  PROCESSED_OPENING_STOCK: "/products/processed/opening-stock",
  /** GET ?productId= — waste history for a processed product row */
  PROCESSED_WASTE_HISTORY: "/products/processed/waste-history",
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
  UPDATE: "/users/update",
  DELETE: "/users/delete",
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
  GET: "/attendances/get",
  CLOCK_IN: "/attendances/clock-in",
  CLOCK_OUT: "/attendances/clock-out",
} as const;

export const SALES_ROUTES = {
  GET: "/sales/get",
  GET_BY_PRODUCT_ID: "/sales/get-by-product-id",
  CREATE: "/sales/create",
  DASHBOARD_SALES: "/sales/dashboardSales",
  LIVESTOCK_CREATE: "/sales/livestock/create",
  LIVESTOCK_GET: "/sales/livestock/get",
} as const;

export const CUSTOMER_TYPE_ROUTES = {
  GET: "/customer-types/get",
  CREATE: "/customer-types/create",
  UPDATE: "/customer-types/update",
  DELETE: "/customer-types/delete",
} as const;

export const PROCESSING_PLANT_ROUTES = {
  GET: "/processing-plants/get",
  CREATE: "/processing-plants/create",
  UPDATE: "/processing-plants/update",
  DELETE: "/processing-plants/delete",
} as const;
