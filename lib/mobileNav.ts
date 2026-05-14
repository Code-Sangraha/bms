import type { AccessTier } from "@/lib/auth/accessTier";

export type MobileTabId = "home" | "transactions" | "parties" | "inventory" | "more" | "clock";

/** Which bottom tab should be active for the current dashboard path. */
export function mobileTabFromPathname(pathname: string, accessTier: AccessTier = "global"): MobileTabId {
  if (accessTier === "outlet_staff") {
    return "parties";
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "home";
  if (pathname.startsWith("/dashboard/invoices")) return "transactions";
  if (pathname === "/dashboard/accounts/directory") return "parties";
  if (pathname.startsWith("/dashboard/product")) return "inventory";
  if (
    pathname === "/dashboard/more" ||
    pathname.startsWith("/dashboard/outlet") ||
    pathname.startsWith("/dashboard/users") ||
    pathname.startsWith("/dashboard/departments") ||
    pathname.startsWith("/dashboard/processingPlant") ||
    pathname.startsWith("/dashboard/dualPricing") ||
    pathname.startsWith("/dashboard/accounts/roles") ||
    pathname.startsWith("/dashboard/accounts/analytics") ||
    pathname.startsWith("/dashboard/accounts/clock-in-out") ||
    pathname === "/dashboard/analytics"
  ) {
    return "more";
  }
  return "home";
}
