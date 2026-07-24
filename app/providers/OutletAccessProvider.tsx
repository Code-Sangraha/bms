"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  deriveAccessTier,
  getAccessTierFromSessionClaims,
  type AccessTier,
} from "@/lib/auth/accessTier";
import {
  buildPathWithOutletScope,
  readOutletScopeFromSearch,
  writeHighlandContextToStorage,
} from "@/lib/outletScope";
import { useAuth } from "@/app/providers/AuthProvider";
import { getOutletIdFromToken } from "@/lib/auth/role";
import { getStoredOutletId } from "@/lib/auth/user";

export type OutletAccessContextValue = {
  accessTier: AccessTier;
  /** When set, URL and Highland plant mode are locked to this outlet. */
  lockedOutletId: string | null;
};

const OutletAccessContext = createContext<OutletAccessContextValue | null>(null);

export function OutletAccessProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleName, userOutletId, userOutletName, accessScope, isAdmin } = useAuth();
  const sessionAccessTier = getAccessTierFromSessionClaims();
  const sessionOutletId = getOutletIdFromToken() ?? getStoredOutletId();

  const value = useMemo<OutletAccessContextValue>(() => {
    const effectiveOutletId = userOutletId ?? sessionOutletId;
    const accessTier =
      isAdmin || accessScope === "global"
        ? "global"
        : roleName == null
          ? sessionAccessTier
          : deriveAccessTier({ roleName, userOutletId: effectiveOutletId });
    let lockedOutletId: string | null = null;
    if (accessTier === "outlet_staff") {
      lockedOutletId = effectiveOutletId;
    } else if (accessTier === "outlet_manager" && effectiveOutletId) {
      /** Managers can switch between outlets from the sidebar; do not force them to their assigned outlet. */
      lockedOutletId = null;
    }
    return { accessTier, lockedOutletId };
  }, [roleName, userOutletId, userOutletName, accessScope, isAdmin, sessionOutletId, sessionAccessTier]);

  const { accessTier, lockedOutletId } = value;

  useEffect(() => {
    if (accessTier === "outlet_staff") return;
    if (!lockedOutletId) return;
    const current = readOutletScopeFromSearch(location.search);
    if (current === lockedOutletId) return;
    navigate(buildPathWithOutletScope(location.pathname, lockedOutletId, location.search), {
      replace: true,
    });
  }, [accessTier, lockedOutletId, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!lockedOutletId) return;
    const plantName = userOutletName?.trim() || "Outlet";
    writeHighlandContextToStorage({
      mode: "plant",
      plantId: lockedOutletId,
      outletId: lockedOutletId,
      plantName,
    });
  }, [lockedOutletId, userOutletName]);

  return (
    <OutletAccessContext.Provider value={value}>{children}</OutletAccessContext.Provider>
  );
}

export function useOutletAccess(): OutletAccessContextValue {
  const ctx = useContext(OutletAccessContext);
  if (ctx == null) {
    return { accessTier: "global", lockedOutletId: null };
  }
  return ctx;
}

export function useOptionalOutletAccess(): OutletAccessContextValue | null {
  return useContext(OutletAccessContext);
}
