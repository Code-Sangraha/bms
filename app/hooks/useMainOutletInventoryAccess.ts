"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { getMainOutletId, getOutlets, type Outlet } from "@/handlers/outlet";

export function isMainOutletName(value: string | null | undefined): boolean {
  const name = value?.trim().toLocaleLowerCase();
  return name === "main" || name === "main outlet";
}

export function resolveMainOutletAdminAccess(input: {
  roleName: string | null;
  userOutletId: string | null;
  userOutletName: string | null;
  outlets: Outlet[];
}): boolean {
  if (input.roleName !== "Admin") return false;
  if (isMainOutletName(input.userOutletName)) return true;
  const mainOutletId = getMainOutletId(input.outlets);
  return Boolean(input.userOutletId && mainOutletId && input.userOutletId === mainOutletId);
}

export function useMainOutletInventoryAccess() {
  const { isAuthReady, roleName, userOutletId, userOutletName } = useAuth();
  const isAdmin = roleName === "Admin";
  const knownFromLogin = isAdmin && isMainOutletName(userOutletName);
  const outletsQuery = useQuery({
    queryKey: ["outlets"],
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: isAuthReady && isAdmin && !knownFromLogin,
  });
  const isLoading = !isAuthReady || (isAdmin && !knownFromLogin && outletsQuery.isLoading);
  const isAllowed = !isLoading && resolveMainOutletAdminAccess({
    roleName,
    userOutletId,
    userOutletName,
    outlets: outletsQuery.data ?? [],
  });
  return { isAllowed, isLoading, error: outletsQuery.error };
}