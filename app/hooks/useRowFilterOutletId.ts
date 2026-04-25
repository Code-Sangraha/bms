"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getOutlets, type Outlet } from "@/handlers/outlet";
import { getProcessingPlants, mergeProcessingPlantOutletFromUsers } from "@/handlers/processingPlant";
import { getUsers } from "@/handlers/user";
import {
  BMS_HIGHLAND_CONTEXT_EVENT,
  getRowScopeIdFromUrlOrHighlandSearch,
} from "@/lib/outletScope";
import { resolveRowFilterOutletId, resolveScopeLabel } from "@/lib/rowFilterOutlet";

const OUTLETS_KEY = ["outlets"];
const PROCESSING_PLANTS_KEY = ["processingPlants"];
const USERS_KEY = ["users"];

/**
 * Resolves scope to the id used on list rows (`product.outletId`, etc.):
 * - `?outletId=` in the URL, or if missing, sub-outlet (Highland) plant mode from session.
 * Plant vs branch-outlet mismatches are fixed via `resolveRowFilterOutletId`.
 */
export function useRowFilterOutletId(): {
  isScoped: boolean;
  scopedOutletId: string | null;
  rowFilterOutletId: string | null;
  /** Empty when not scoped. */
  scopeLabel: string;
  outlets: Outlet[];
  mergedPlants: ReturnType<typeof mergeProcessingPlantOutletFromUsers>;
} {
  const location = useLocation();
  const [highlandTick, setHighlandTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setHighlandTick((n) => n + 1);
    window.addEventListener(BMS_HIGHLAND_CONTEXT_EVENT, bump);
    return () => window.removeEventListener(BMS_HIGHLAND_CONTEXT_EVENT, bump);
  }, []);
  const scopedOutletId = useMemo(
    () => getRowScopeIdFromUrlOrHighlandSearch(location.search),
    [location.search, highlandTick]
  );
  const isScoped = Boolean(scopedOutletId);
  const scopeEnabled = Boolean(scopedOutletId);

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: scopeEnabled,
    staleTime: 60_000,
  });

  const { data: processingPlants = [] } = useQuery({
    queryKey: PROCESSING_PLANTS_KEY,
    queryFn: async () => {
      const result = await getProcessingPlants();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: scopeEnabled,
    staleTime: 60_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: scopeEnabled,
    staleTime: 60_000,
  });

  const mergedPlants = useMemo(
    () => mergeProcessingPlantOutletFromUsers(processingPlants, users),
    [processingPlants, users]
  );

  const rowFilterOutletId = useMemo(
    () =>
      isScoped && scopedOutletId
        ? resolveRowFilterOutletId(scopedOutletId, outlets, mergedPlants)
        : null,
    [isScoped, scopedOutletId, outlets, mergedPlants]
  );

  const scopeLabel = useMemo(() => {
    if (!isScoped || !scopedOutletId || !rowFilterOutletId) return "";
    return resolveScopeLabel(scopedOutletId, rowFilterOutletId, outlets, mergedPlants);
  }, [isScoped, scopedOutletId, rowFilterOutletId, outlets, mergedPlants]);

  return {
    isScoped,
    scopedOutletId,
    rowFilterOutletId,
    scopeLabel,
    outlets,
    mergedPlants,
  };
}
