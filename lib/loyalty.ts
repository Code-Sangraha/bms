import type { SalesByCustomerItem } from "@/handlers/sale";

/** Backend hardcodes 1 kg reward per this many kg purchased. */
export const LOYALTY_KG_PER_REWARD = 20;

export function computeEarnedRewardKg(totalPurchasedKg: number): number {
  if (!Number.isFinite(totalPurchasedKg) || totalPurchasedKg <= 0) return 0;
  return Math.floor(totalPurchasedKg / LOYALTY_KG_PER_REWARD);
}

export function computeAvailableRewardKg(
  totalPurchasedKg: number,
  redeemedRewardKg: number
): number {
  const earned = computeEarnedRewardKg(totalPurchasedKg);
  const redeemed = Number.isFinite(redeemedRewardKg) ? redeemedRewardKg : 0;
  return Math.max(0, earned - redeemed);
}

/** Client-side redeem guard for future UI — backend does not validate balance or stock. */
export function canRedeem(
  totalPurchasedKg: number,
  redeemedRewardKg: number,
  redeemWeight: number,
  productWeight: number
): boolean {
  const available = computeAvailableRewardKg(totalPurchasedKg, redeemedRewardKg);
  return (
    redeemWeight > 0 &&
    redeemWeight <= available &&
    redeemWeight <= productWeight
  );
}

export type CustomerLoyaltyView = {
  name: string;
  contact?: string | null;
  outletId: string;
  totalPurchasedKg: number;
  totalAmountSpent: number;
  earnedRewardKg: number;
  redeemedRewardKg: number;
  availableRewardKg: number;
};

export function loyaltyFromSalesByCustomer(
  row: SalesByCustomerItem,
  redeemedRewardKg = 0
): Pick<
  CustomerLoyaltyView,
  "totalPurchasedKg" | "totalAmountSpent" | "earnedRewardKg" | "redeemedRewardKg" | "availableRewardKg"
> {
  const totalPurchasedKg = row.totalWeight ?? 0;
  const totalAmountSpent = row.totalAmount ?? 0;
  const earnedRewardKg = computeEarnedRewardKg(totalPurchasedKg);
  const redeemed = Number.isFinite(redeemedRewardKg) ? redeemedRewardKg : 0;
  return {
    totalPurchasedKg,
    totalAmountSpent,
    earnedRewardKg,
    redeemedRewardKg: redeemed,
    availableRewardKg: Math.max(0, earnedRewardKg - redeemed),
  };
}

/** Case-sensitive match — backend loyalty uses exact outletId + name. */
export function findSalesByCustomerRow(
  rows: SalesByCustomerItem[],
  customerName: string
): SalesByCustomerItem | undefined {
  const trimmed = customerName.trim();
  if (!trimmed) return undefined;
  return rows.find((row) => row.customerName === trimmed);
}
