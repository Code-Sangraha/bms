import type { SalesByCustomerItem } from "@/handlers/sale";

/** Conservative display fallback used only when the backend has no configured rule. */
export const LOYALTY_KG_PER_REWARD = 20;
export const DEFAULT_LOYALTY_REWARD_KG = 1;
export const LOYALTY_RULE_QUERY_KEY = ["loyaltyRule", "current"] as const;

export type LoyaltyRuleValues = {
  minPurchaseKg: number;
  rewardKg: number;
};

export type SessionLoyaltyRule = LoyaltyRuleValues & {
  createdAt?: string;
  message?: string;
};

function positiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function normalizeLoyaltyRule(rule?: Partial<LoyaltyRuleValues> | null): LoyaltyRuleValues {
  return {
    minPurchaseKg: positiveNumber(rule?.minPurchaseKg) ?? LOYALTY_KG_PER_REWARD,
    rewardKg: positiveNumber(rule?.rewardKg) ?? DEFAULT_LOYALTY_REWARD_KG,
  };
}

export function computeEarnedRewardKg(
  totalPurchasedKg: number,
  rule?: Partial<LoyaltyRuleValues> | null
): number {
  if (!Number.isFinite(totalPurchasedKg) || totalPurchasedKg <= 0) return 0;
  const normalized = normalizeLoyaltyRule(rule);
  return Math.floor(totalPurchasedKg / normalized.minPurchaseKg) * normalized.rewardKg;
}

export function computeAvailableRewardKg(
  totalPurchasedKg: number,
  redeemedRewardKg: number,
  rule?: Partial<LoyaltyRuleValues> | null
): number {
  const earned = computeEarnedRewardKg(totalPurchasedKg, rule);
  const redeemed = Number.isFinite(redeemedRewardKg) ? redeemedRewardKg : 0;
  return Math.max(0, earned - redeemed);
}

/** Client-side redeem guard for future UI. Backend should still validate balance and stock. */
export function canRedeem(
  totalPurchasedKg: number,
  redeemedRewardKg: number,
  redeemWeight: number,
  productWeight: number,
  rule?: Partial<LoyaltyRuleValues> | null
): boolean {
  const available = computeAvailableRewardKg(totalPurchasedKg, redeemedRewardKg, rule);
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
  redeemedRewardKg = 0,
  rule?: Partial<LoyaltyRuleValues> | null
): Pick<
  CustomerLoyaltyView,
  "totalPurchasedKg" | "totalAmountSpent" | "earnedRewardKg" | "redeemedRewardKg" | "availableRewardKg"
> {
  const totalPurchasedKg = row.totalWeight ?? 0;
  const totalAmountSpent = row.totalAmount ?? 0;
  const earnedRewardKg = computeEarnedRewardKg(totalPurchasedKg, rule);
  const redeemed = Number.isFinite(redeemedRewardKg) ? redeemedRewardKg : 0;
  return {
    totalPurchasedKg,
    totalAmountSpent,
    earnedRewardKg,
    redeemedRewardKg: redeemed,
    availableRewardKg: Math.max(0, earnedRewardKg - redeemed),
  };
}

/** Case-sensitive match because backend loyalty currently uses exact outletId + name. */
export function findSalesByCustomerRow(
  rows: SalesByCustomerItem[],
  customerName: string
): SalesByCustomerItem | undefined {
  const trimmed = customerName.trim();
  if (!trimmed) return undefined;
  return rows.find((row) => row.customerName === trimmed);
}
