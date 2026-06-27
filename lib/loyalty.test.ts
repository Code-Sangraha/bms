import { describe, expect, it } from "vitest";
import {
  computeEarnedRewardKg,
  computeAvailableRewardKg,
  normalizeLoyaltyRule,
} from "./loyalty";

describe("loyalty helpers", () => {
  it("uses the fallback 20kg to 1kg rule when no rule is known", () => {
    expect(computeEarnedRewardKg(45)).toBe(2);
  });

  it("uses custom session rule values for estimates", () => {
    expect(computeEarnedRewardKg(25, { minPurchaseKg: 10, rewardKg: 2 })).toBe(4);
  });

  it("returns 0 for invalid or empty totals", () => {
    expect(computeEarnedRewardKg(0)).toBe(0);
    expect(computeEarnedRewardKg(Number.NaN)).toBe(0);
    expect(computeAvailableRewardKg(0, 3)).toBe(0);
  });

  it("normalizes invalid rule values back to the fallback", () => {
    expect(normalizeLoyaltyRule({ minPurchaseKg: 0, rewardKg: -1 })).toEqual({
      minPurchaseKg: 20,
      rewardKg: 1,
    });
  });
});
