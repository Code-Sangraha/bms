"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { getInventoryOutlets, type InventoryOutlet } from "@/handlers/itemInventory";
import { buildPathWithOutletScope, readOutletScopeFromSearch } from "@/lib/outletScope";
import { inventoryQueryKeys } from "./inventoryQueries";

export type InventoryPermissions = {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  restock: boolean;
  allOutlets: boolean;
};

type InventoryScopeValue = {
  outletId: string;
  outlets: InventoryOutlet[];
  permissions: InventoryPermissions;
  isLoading: boolean;
  error: string | null;
  selectOutlet: (id: string) => void;
};

const InventoryScopeContext = createContext<InventoryScopeValue | null>(null);

export function InventoryScopeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = useMemo<InventoryPermissions>(() => ({
    read: auth.hasJwtPermission("inventory:read"),
    create: auth.hasJwtPermission("inventory:create"),
    update: auth.hasJwtPermission("inventory:update"),
    delete: auth.hasJwtPermission("inventory:delete"),
    restock: auth.hasJwtPermission("inventory:restock"),
    allOutlets: auth.hasJwtPermission("inventory:all-outlets"),
  }), [auth]);
  const requestedOutletId = readOutletScopeFromSearch(location.search);
  const outletsQuery = useQuery({
    queryKey: inventoryQueryKeys.outlets,
    queryFn: async () => {
      const result = await getInventoryOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: auth.isAuthReady && permissions.read && permissions.allOutlets,
    staleTime: 60_000,
  });
  const outlets = outletsQuery.data ?? [];
  const outletId = permissions.allOutlets
    ? (requestedOutletId ?? outlets[0]?.id ?? "")
    : (auth.userOutletId ?? "");

  useEffect(() => {
    if (!permissions.allOutlets || requestedOutletId || !outletId) return;
    navigate(buildPathWithOutletScope(location.pathname, outletId, location.search), { replace: true });
  }, [location.pathname, location.search, navigate, outletId, permissions.allOutlets, requestedOutletId]);

  const selectOutlet = (id: string) => {
    navigate(buildPathWithOutletScope(location.pathname, id || null, location.search));
  };
  const error = outletsQuery.error instanceof Error
    ? outletsQuery.error.message
    : auth.isAuthReady && permissions.read && !outletId && !outletsQuery.isLoading
      ? "No outlet is assigned or available for inventory."
      : null;

  return (
    <InventoryScopeContext.Provider value={{
      outletId,
      outlets,
      permissions,
      isLoading: !auth.isAuthReady || outletsQuery.isLoading,
      error,
      selectOutlet,
    }}>
      {children}
    </InventoryScopeContext.Provider>
  );
}

export function useInventoryScope(): InventoryScopeValue {
  const value = useContext(InventoryScopeContext);
  if (!value) throw new Error("useInventoryScope must be used inside InventoryScopeProvider");
  return value;
}
