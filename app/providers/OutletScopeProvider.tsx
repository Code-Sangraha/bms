"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOutlets } from "@/handlers/outlet";
import { getProcessingPlants, mergeProcessingPlantOutletFromUsers } from "@/handlers/processingPlant";
import { getUsers } from "@/handlers/user";
import { getAccessTierFromSessionClaims } from "@/lib/auth/accessTier";
import { getAuthToken } from "@/lib/auth/token";
import { useToast } from "@/app/providers/ToastProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { readOutletScopeFromSearch, buildPathWithOutletScope } from "@/lib/outletScope";
import { useI18n } from "@/app/providers/I18nProvider";

export type OutletScopeContextValue = {
  scopedOutletId: string | null;
  isScoped: boolean;
  /** Removes outlet scope from the current URL (keeps other search params). */
  clearOutletScopeFromUrl: () => void;
};

const OutletScopeContext = createContext<OutletScopeContextValue | null>(null);

export function OutletScopeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { lockedOutletId } = useOutletAccess();

  const scopedOutletId = useMemo(
    () => readOutletScopeFromSearch(location.search),
    [location.search]
  );

  /** AuthProvider tier can lag one frame; use JWT + stored outlet so Staff never enables admin-only scope fetches. */
  const authTokenSnapshot = typeof window !== "undefined" ? getAuthToken() ?? "" : "";
  const scopeAccessTier = useMemo(
    () => getAccessTierFromSessionClaims(),
    [location.pathname, location.search, authTokenSnapshot]
  );

  /** Staff JWT cannot call outlet/plant/user list APIs. */
  const scopeHeavyFetchesEnabled = Boolean(scopedOutletId) && scopeAccessTier !== "outlet_staff";

  const { data: outlets, isFetched, isSuccess, isError } = useQuery({
    queryKey: ["outlets"],
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(scopedOutletId) && scopeAccessTier !== "outlet_staff",
    staleTime: 60_000,
  });

  const { data: processingPlants = [], isFetched: plantsFetched } = useQuery({
    queryKey: ["processingPlants"],
    queryFn: async () => {
      const result = await getProcessingPlants();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: scopeHeavyFetchesEnabled,
    staleTime: 60_000,
  });

  const { data: users = [], isFetched: usersFetched } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: scopeHeavyFetchesEnabled,
    staleTime: 60_000,
  });

  const mergedPlants = useMemo(
    () => mergeProcessingPlantOutletFromUsers(processingPlants, users),
    [processingPlants, users]
  );

  const invalidHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scopedOutletId) {
      invalidHandledRef.current = null;
      return;
    }
    if (lockedOutletId && scopedOutletId === lockedOutletId) {
      invalidHandledRef.current = null;
      return;
    }
    if (!isFetched) return;
    if (isError) return;
    if (!isSuccess || !outlets) return;
    if (outlets.some((o) => o.id === scopedOutletId)) {
      invalidHandledRef.current = null;
      return;
    }
    if (scopeAccessTier === "outlet_staff") {
      if (invalidHandledRef.current === scopedOutletId) return;
      invalidHandledRef.current = scopedOutletId;
      const next = buildPathWithOutletScope(location.pathname, null, location.search);
      navigate(next, { replace: true });
      showToast(t("Invalid outlet filter was removed."));
      return;
    }
    if (!plantsFetched || !usersFetched) return;
    const validPlantScope = mergedPlants.some(
      (p) => p.id === scopedOutletId || p.outletId === scopedOutletId
    );
    if (validPlantScope) {
      invalidHandledRef.current = null;
      return;
    }
    if (invalidHandledRef.current === scopedOutletId) return;
    invalidHandledRef.current = scopedOutletId;
    const next = buildPathWithOutletScope(location.pathname, null, location.search);
    navigate(next, { replace: true });
    showToast(t("Invalid outlet filter was removed."));
  }, [
    scopedOutletId,
    isFetched,
    isSuccess,
    isError,
    outlets,
    plantsFetched,
    usersFetched,
    mergedPlants,
    location.pathname,
    location.search,
    navigate,
    showToast,
    t,
    lockedOutletId,
    scopeAccessTier,
  ]);

  const clearOutletScopeFromUrl = useCallback(() => {
    const next = buildPathWithOutletScope(location.pathname, null, location.search);
    navigate(next, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const value = useMemo<OutletScopeContextValue>(
    () => ({
      scopedOutletId,
      isScoped: Boolean(scopedOutletId),
      clearOutletScopeFromUrl,
    }),
    [scopedOutletId, clearOutletScopeFromUrl]
  );

  return (
    <OutletScopeContext.Provider value={value}>{children}</OutletScopeContext.Provider>
  );
}

export function useOutletScope(): OutletScopeContextValue {
  const ctx = useContext(OutletScopeContext);
  if (!ctx) {
    throw new Error("useOutletScope must be used within OutletScopeProvider");
  }
  return ctx;
}
