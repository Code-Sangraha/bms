"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletScope } from "@/app/providers/OutletScopeProvider";
import { getOutlets, type Outlet } from "@/handlers/outlet";
import { getProcessingPlants, mergeProcessingPlantOutletFromUsers } from "@/handlers/processingPlant";
import { getUsers } from "@/handlers/user";
import { resolveRowFilterOutletId, resolveScopeLabel } from "@/lib/rowFilterOutlet";

const OUTLETS_KEY = ["outlets"];
const PROCESSING_PLANTS_KEY = ["processingPlants"];
const USERS_KEY = ["users"];

/**
 * Resolves `?outletId=` to the id that appears on list rows. When that still does not
 * match backend row data, fixing data is a backend concern; this hook fixes plant-id vs
 * product `outletId` mismatches for sub-outlet navigation.
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
  const { isScoped, scopedOutletId } = useOutletScope();
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
