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
  /** GET with JSON body `{ outletId? }` — controller may return 201 on success */
  GET_EXPENSES: "/outlets/get-expenses",
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
  /** List livestock rows for a category: try `GET ?productId=` first; some stacks also accept `POST` with `{ productId }`. */
  LIVESTOCK_GET_ITEMS_BY_PRODUCT: "/products/livestock/get-items-by-product",
  LIVESTOCK_RESTOCK: "/products/livestock/restock",
  LIVESTOCK_DEDUCT: "/products/livestock/deduct",
  LIVESTOCK_UPDATE_ITEM: "/products/livestock/update-item",
  /** POST `livestock/delete-item` — body `{ productId }` (misnamed: value is row **itemId**, not parent product id). */
  LIVESTOCK_DELETE_ITEM: "/products/livestock/delete-item",
  /**
   * GET restock/deduct movement history. Server reads JSON body; SPA uses axios GET + `data` (fetch cannot send GET body).
   * Prefer backend reading query params so this can move to `apiRequest` without axios.
   */
  LIVESTOCK_INVENTORY_HISTORY: "/products/livestock/history",
  /** GET restock expense history. Server reads JSON body; SPA uses axios GET + `data`. */
  LIVESTOCK_EXPENSE_HISTORY: "/products/livestock/expense-history",
  /** @deprecated Unused: livestock waste UI calls LIVESTOCK_INVENTORY_HISTORY with JSON body instead. */
  LIVESTOCK_WASTE_HISTORY: "/products/livestock/waste-history",
  LIVESTOCK_SEND_TO_PROCESSING: "/products/livestock/send-to-processing",
  LIVESTOCK_EDIT_SEND_TO_PROCESSING: "/products/livestock/edit-send-to-processing",
  LIVESTOCK_COMPLETE_PROCESSING: "/products/livestock/complete-processing",
  LIVESTOCK_GET_PENDING_PROCESSING: "/products/livestock/get-pending-processing",
  LIVESTOCK_GET_COMPLETED_PROCESSING: "/products/livestock/get-completed-processing",
  /** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — placeholder until backend matches doc shape */
  LIVESTOCK_OPENING_STOCK: "/products/livestock/opening-stock",
  /** GET ?from=&to= — processed products opening/closing stock (same payload shape as livestock) */
  PROCESSED_OPENING_STOCK: "/products/processed/opening-stock",
  /** GET ?productId= — waste history for a processed product row */
  PROCESSED_WASTE_HISTORY: "/products/processed/waste-history",
  /** GET ?fromDate=&toDate=&productId=&type= — restock/deduct movement (query only; no GET body) */
  PROCESSED_INVENTORY_HISTORY: "/products/processed/history",
  PROCESSED_TRANSFER: "/products/processed/transfer",
  WASTE_CREATE: "/products/waste/create",
  WASTE_GET: "/products/waste/get",
  LIVESTOCK_COMPLETE_PARTIAL_PAYMENT: "/products/livestock/complete-partial-payment",
} as const;

export const ROLE_ROUTES = {
  GET: "/roles/get",
  CREATE: "/roles/create",
  UPDATE: "/roles/update",
  DELETE: "/roles/delete",
  PERMISSIONS: "/roles/permissions",
  UPDATE_PERMISSIONS: "/roles/update-permissions",
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
  UPDATE: "/employees/update",
} as const;

export const ATTENDANCE_ROUTES = {
  GET: "/attendances/get",
  TODAY_STATUS: "/attendances/today-status",
  CLOCK_IN: "/attendances/clock-in",
  CLOCK_OUT: "/attendances/clock-out",
} as const;

export const SALES_ROUTES = {
  GET: "/sales/get",
  GET_BY_PRODUCT_ID: "/sales/get-by-product-id",
  GET_BY_CUSTOMER: "/sales/get-by-customer",
  CREATE: "/sales/create",
  DASHBOARD_SALES: "/sales/dashboardSales",
  LOYALTY_RULE_GET: "/sales/loyalty-rules/get",
  LOYALTY_RULE_CREATE: "/sales/loyalty-rules/create",
  REDEEM: "/sales/redeem",
  LIVESTOCK_CREATE: "/sales/livestock/create",
  LIVESTOCK_GET: "/sales/livestock/get",
} as const;

export const SUPPLIER_ROUTES = {
  GET: "/suppliers/get",
  GET_BY_ID: "/suppliers/get-by-id",
  CREATE: "/suppliers/create",
  UPDATE: "/suppliers/update",
  DELETE: "/suppliers/delete",
} as const;

export const CUSTOMER_TYPE_ROUTES = {
  GET: "/customer-types/get",
  CREATE: "/customer-types/create",
  UPDATE: "/customer-types/update",
  DELETE: "/customer-types/delete",
} as const;

export const CUSTOMER_ROUTES = {
  GET: "/customers/get",
  GET_BY_ID: "/customers/get-by-id",
  CREATE: "/customers/create",
  UPDATE: "/customers/update",
  DELETE: "/customers/delete",
} as const;

export const PROCESSING_PLANT_ROUTES = {
  GET: "/processing-plants/get",
  CREATE: "/processing-plants/create",
  UPDATE: "/processing-plants/update",
  DELETE: "/processing-plants/delete",
} as const;



