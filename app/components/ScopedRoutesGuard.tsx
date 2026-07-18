"use client";

import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { defaultPathForTier, isPathAllowedForTier } from "@/lib/auth/accessTier";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useMainOutletInventoryAccess } from "@/app/hooks/useMainOutletInventoryAccess";
import type { RoleCapabilities } from "@/lib/auth/capabilities";

function isPathAllowedByCapabilities(pathname: string, capabilities: RoleCapabilities): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/dashboard") return true;
  if (p.startsWith("/dashboard/outlets")) return capabilities.canViewOutlets;
  if (p.startsWith("/dashboard/outlet")) return capabilities.canViewOutlets;
  if (p.startsWith("/dashboard/dualPricing")) return capabilities.canViewDualPricing;
  if (p.startsWith("/dashboard/processingPlant")) return capabilities.canSendToProcessing || capabilities.canCompleteProcessing;
  if (p.startsWith("/dashboard/invoices/livestock-sales")) return capabilities.canCreateLivestockSales;
  if (p.startsWith("/dashboard/invoices/waste-sales")) return capabilities.canCreateProcessedSales;
  if (p.startsWith("/dashboard/invoices/customer-types")) return false;
  if (p.startsWith("/dashboard/invoices/loyalty-rules")) return false;
  if (p.startsWith("/dashboard/invoices/new")) return capabilities.canCreateProcessedSales;
  if (p.startsWith("/dashboard/invoices/transaction")) return capabilities.canViewTransactions;
  if (p.startsWith("/dashboard/invoices")) return capabilities.canViewSalesAnalytics;
  if (p.startsWith("/dashboard/analytics")) return capabilities.canViewSalesAnalytics;
  if (p.startsWith("/dashboard/product/productType")) return capabilities.canCreateProducts;
  if (p.startsWith("/dashboard/product/livestockCategory")) return capabilities.canCreateProducts;
  if (p.startsWith("/dashboard/product/liveProduct")) return capabilities.canViewLivestockInventory;
  if (p.startsWith("/dashboard/product/processedProduct")) return capabilities.canViewProcessedInventory;
  if (p.startsWith("/dashboard/product/wasteProduct")) return capabilities.canViewProcessedInventory;
  if (p.startsWith("/dashboard/product")) return capabilities.canViewInventory;
  if (p.startsWith("/dashboard/accounts/analytics")) return capabilities.canViewAttendance;
  if (p.startsWith("/dashboard/accounts/clock-in-out")) return capabilities.canClockInOut;
  if (p.startsWith("/dashboard/accounts/directory")) return false;
  if (p.startsWith("/dashboard/more")) return true;
  return true;
}

export default function ScopedRoutesGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessTier, lockedOutletId } = useOutletAccess();
  const { capabilities, hasJwtPermission, isAuthReady } = usePermissions();
  const inventoryAccess = useMainOutletInventoryAccess();

  useEffect(() => {
    if (!isAuthReady) return;
    const path = location.pathname.replace(/\/$/, "");
    if (path === "/dashboard/accounts/roles/create") {
      if (!hasJwtPermission("role:create")) navigate("/dashboard", { replace: true });
      return;
    }
    if (path.startsWith("/dashboard/accounts/roles") && !hasJwtPermission("role:read")) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (path.startsWith("/dashboard/item-inventory")) {
      if (inventoryAccess.isLoading) return;
      if (!inventoryAccess.isAllowed) navigate("/dashboard", { replace: true });
    }
  }, [hasJwtPermission, inventoryAccess.isAllowed, inventoryAccess.isLoading, isAuthReady, location.pathname, navigate]);

  useEffect(() => {
    if (accessTier === "global") return;
    if (isPathAllowedForTier(location.pathname, accessTier)) return;
    navigate(defaultPathForTier(accessTier, lockedOutletId), { replace: true });
  }, [accessTier, lockedOutletId, location.pathname, navigate]);

  useEffect(() => {
    if (accessTier === "global") return;
    if (isPathAllowedByCapabilities(location.pathname, capabilities)) return;
    navigate(defaultPathForTier(accessTier, lockedOutletId), { replace: true });
  }, [accessTier, capabilities, lockedOutletId, location.pathname, navigate]);

  return <>{children}</>;
}