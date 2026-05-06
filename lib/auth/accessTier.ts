import type { RoleName } from "@/lib/auth/permissions";

export type AccessTier = "global" | "outlet_manager" | "outlet_staff";

export type AccessTierInput = {
  roleName: RoleName | null;
  userOutletId: string | null;
};

/**
 * Routes outlet-scoped users may open (prefix match on pathname).
 * `/dashboard` allows the home route only when pathname is exactly `/dashboard` or `/dashboard/`
 * — use isPathAllowedForTier for correct handling.
 */
export const OUTLET_MANAGER_PATH_PREFIXES: string[] = [
  "/dashboard/invoices",
  "/dashboard/product",
  "/dashboard/accounts/analytics",
  "/dashboard/accounts/clock-in-out",
  "/dashboard/accounts/directory",
  "/dashboard/more",
];

export const OUTLET_STAFF_ALLOWED_EXACT: string[] = ["/dashboard/accounts/clock-in-out"];

/** Default landing path segments (no query) after guard redirect. */
export const OUTLET_MANAGER_HOME_PATH = "/dashboard";
export const OUTLET_STAFF_HOME_PATH = "/dashboard/accounts/clock-in-out";

export function deriveAccessTier({ roleName, userOutletId }: AccessTierInput): AccessTier {
  if (roleName === "Admin") return "global";
  if (roleName === "Staff" && userOutletId) return "outlet_staff";
  if (userOutletId) return "outlet_manager";
  /** Non-admin without outlet: treat as global-style navigation (rare); avoid locking URL. */
  return "global";
}

function normalizePathname(pathname: string): string {
  if (pathname === "/dashboard") return "/dashboard";
  return pathname.replace(/\/$/, "") || "/";
}

/**
 * `/dashboard` overview only (not e.g. `/dashboard/outlet`).
 */
function isOutletManagerDashboardHome(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return p === "/dashboard";
}

export function isPathAllowedForTier(pathname: string, tier: AccessTier): boolean {
  const p = normalizePathname(pathname);

  if (tier === "global") return true;

  if (tier === "outlet_staff") {
    return OUTLET_STAFF_ALLOWED_EXACT.some((allowed) => p === allowed || p.startsWith(`${allowed}/`));
  }

  if (isOutletManagerDashboardHome(p)) return true;

  return OUTLET_MANAGER_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

export function defaultPathForTier(tier: AccessTier, withOutletId: string | null): string {
  if (tier === "outlet_staff") {
    return withOutletId
      ? `${OUTLET_STAFF_HOME_PATH}?outletId=${encodeURIComponent(withOutletId)}`
      : OUTLET_STAFF_HOME_PATH;
  }
  if (tier === "outlet_manager") {
    return withOutletId
      ? `${OUTLET_MANAGER_HOME_PATH}?outletId=${encodeURIComponent(withOutletId)}`
      : OUTLET_MANAGER_HOME_PATH;
  }
  return OUTLET_MANAGER_HOME_PATH;
}
