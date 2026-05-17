import type { RoleName } from "@/lib/auth/permissions";

export type RoleCapabilities = {
  canViewOutlets: boolean;
  canViewAttendance: boolean;
  canClockInOut: boolean;
  canViewInventory: boolean;
  canViewProcessedInventory: boolean;
  canViewLivestockInventory: boolean;
  canViewInventoryDetails: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canCreateProducts: boolean;
  canRestockProcessedInventory: boolean;
  canDeductProcessedInventory: boolean;
  canRestockLivestockInventory: boolean;
  canDeductLivestockInventory: boolean;
  canSendToProcessing: boolean;
  canCompleteProcessing: boolean;
  canCreateProcessingPlants: boolean;
  canEditProcessingBatches: boolean;
  canViewDualPricing: boolean;
  canEditDualPricing: boolean;
  canViewProcessedSales: boolean;
  canViewSalesAnalytics: boolean;
  canCreateProcessedSales: boolean;
  canViewLivestockSales: boolean;
  canCreateLivestockSales: boolean;
  canViewTransactions: boolean;
  canInputWasteProducts: boolean;
};

const ALL_CAPABILITIES: RoleCapabilities = {
  canViewOutlets: true,
  canViewAttendance: true,
  canClockInOut: true,
  canViewInventory: true,
  canViewProcessedInventory: true,
  canViewLivestockInventory: true,
  canViewInventoryDetails: true,
  canEditProducts: true,
  canDeleteProducts: true,
  canCreateProducts: true,
  canRestockProcessedInventory: true,
  canDeductProcessedInventory: true,
  canRestockLivestockInventory: true,
  canDeductLivestockInventory: true,
  canSendToProcessing: true,
  canCompleteProcessing: true,
  canCreateProcessingPlants: true,
  canEditProcessingBatches: true,
  canViewDualPricing: true,
  canEditDualPricing: true,
  canViewProcessedSales: true,
  canViewSalesAnalytics: true,
  canCreateProcessedSales: true,
  canViewLivestockSales: true,
  canCreateLivestockSales: true,
  canViewTransactions: true,
  canInputWasteProducts: true,
};

const NO_CAPABILITIES: RoleCapabilities = {
  canViewOutlets: false,
  canViewAttendance: false,
  canClockInOut: false,
  canViewInventory: false,
  canViewProcessedInventory: false,
  canViewLivestockInventory: false,
  canViewInventoryDetails: false,
  canEditProducts: false,
  canDeleteProducts: false,
  canCreateProducts: false,
  canRestockProcessedInventory: false,
  canDeductProcessedInventory: false,
  canRestockLivestockInventory: false,
  canDeductLivestockInventory: false,
  canSendToProcessing: false,
  canCompleteProcessing: false,
  canCreateProcessingPlants: false,
  canEditProcessingBatches: false,
  canViewDualPricing: false,
  canEditDualPricing: false,
  canViewProcessedSales: false,
  canViewSalesAnalytics: false,
  canCreateProcessedSales: false,
  canViewLivestockSales: false,
  canCreateLivestockSales: false,
  canViewTransactions: false,
  canInputWasteProducts: false,
};

const ROLE_CAPABILITIES: Record<RoleName, RoleCapabilities> = {
  Admin: ALL_CAPABILITIES,
  Manager: {
    ...NO_CAPABILITIES,
    canViewOutlets: true,
    canViewAttendance: true,
    canClockInOut: true,
    canViewInventory: true,
    canViewProcessedInventory: true,
    canViewLivestockInventory: true,
    canViewInventoryDetails: true,
    canRestockProcessedInventory: true,
    canDeductProcessedInventory: true,
    canRestockLivestockInventory: true,
    canDeductLivestockInventory: true,
    canSendToProcessing: true,
    canCompleteProcessing: true,
    canViewDualPricing: true,
    canViewProcessedSales: true,
    canViewSalesAnalytics: true,
    canCreateProcessedSales: true,
    canViewLivestockSales: true,
    canCreateLivestockSales: true,
    canViewTransactions: true,
    canInputWasteProducts: true,
  },
  Staff: {
    ...NO_CAPABILITIES,
    canClockInOut: true,
    canViewInventory: true,
    canViewProcessedInventory: true,
    canViewLivestockInventory: false,
    canViewInventoryDetails: true,
    canDeductProcessedInventory: true,
    canViewProcessedSales: true,
    canViewSalesAnalytics: false,
    canCreateProcessedSales: true,
    canViewTransactions: true,
    canInputWasteProducts: true,
  },
  Driver: {
    ...NO_CAPABILITIES,
    canClockInOut: true,
  },
  Viewer: NO_CAPABILITIES,
};

export function getRoleCapabilities(roleName: RoleName | null | undefined): RoleCapabilities {
  if (!roleName) return NO_CAPABILITIES;
  return ROLE_CAPABILITIES[roleName] ?? NO_CAPABILITIES;
}
