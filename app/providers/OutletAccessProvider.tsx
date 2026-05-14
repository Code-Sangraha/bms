"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { getMainOutletId, getOutlets } from "@/handlers/outlet";
import { getOutletIdFromToken } from "@/lib/auth/role";
import { getStoredOutletId } from "@/lib/auth/user";

const OUTLETS_QUERY_KEY = ["outlets"];

export type OutletAccessContextValue = {
  accessTier: AccessTier;
  /** When set, URL and Highland plant mode are locked to this outlet. */
  lockedOutletId: string | null;
};

const OutletAccessContext = createContext<OutletAccessContextValue | null>(null);

export function OutletAccessProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleName, userOutletId, userOutletName } = useAuth();
  const sessionAccessTier = getAccessTierFromSessionClaims();
  const sessionOutletId = getOutletIdFromToken() ?? getStoredOutletId();
  const shouldLoadOutlets = sessionAccessTier !== "outlet_staff";

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: shouldLoadOutlets,
  });

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);

  const value = useMemo<OutletAccessContextValue>(() => {
    const effectiveOutletId = userOutletId ?? sessionOutletId;
    const accessTier =
      roleName == null
        ? sessionAccessTier
        : deriveAccessTier({ roleName, userOutletId: effectiveOutletId });
    let lockedOutletId: string | null = null;
    if (accessTier === "outlet_staff") {
      lockedOutletId = effectiveOutletId;
    } else if (accessTier === "outlet_manager" && effectiveOutletId) {
      /** Main-outlet managers choose a plant via sidebar; do not force `?outletId=` to main. */
      if (mainOutletId != null && effectiveOutletId === mainOutletId) {
        lockedOutletId = null;
      } else {
        lockedOutletId = effectiveOutletId;
      }
    }
    return { accessTier, lockedOutletId };
  }, [roleName, userOutletId, sessionOutletId, sessionAccessTier, mainOutletId]);

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
