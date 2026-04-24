import type { DualPricing } from "@/handlers/dualPricing";

/**
 * POS and product UI match dual-pricing rows by **productId + outletId**.
 * Backend sale logic may resolve by productId only; keep DB rows consistent with this keying.
 */
export function findDualPricingRow(
  dualPricings: DualPricing[],
  productId: string,
  outletId: string
): DualPricing | undefined {
  return dualPricings.find(
    (d) => d.productId === productId && d.outletId === outletId
  );
}

/** True when a row exists and both retail and wholesale are positive (either customer type can be priced on POS). */
export function hasDualPricingForProductOutlet(
  dualPricings: DualPricing[],
  productId: string,
  outletId: string
): boolean {
  const row = findDualPricingRow(dualPricings, productId, outletId);
  if (!row) return false;
  const retail = Number(row.retailPrice);
  const wholesale = Number(row.wholesalePrice);
  return (
    Number.isFinite(retail) &&
    Number.isFinite(wholesale) &&
    retail > 0 &&
    wholesale > 0
  );
}

export function getUnitPrice(
  dualPricings: DualPricing[],
  productId: string,
  outletId: string,
  isWholesale: boolean
): number {
  const dp = findDualPricingRow(dualPricings, productId, outletId);
  if (!dp) return 0;
  return isWholesale ? dp.wholesalePrice : dp.retailPrice;
}
