import { describe, expect, it } from "vitest";
import {
  allocateCartDiscount,
  cartSubtotal,
  lineSubtotal,
} from "./saleCalculations";

describe("saleCalculations", () => {
  it("uses weight × unitPrice by default", () => {
    expect(lineSubtotal({ weight: 2, unitPrice: 50 })).toBe(100);
  });

  it("uses amount override when set", () => {
    expect(
      lineSubtotal({ weight: 0.5, unitPrice: 50, amountOverride: 200 })
    ).toBe(200);
  });

  it("allocates cart discount proportionally with exact total", () => {
    const lines = [
      { weight: 2, unitPrice: 50 },
      { weight: 1, unitPrice: 100 },
    ];
    const discounts = allocateCartDiscount(lines, 30);
    expect(discounts.reduce((a, b) => a + b, 0)).toBeCloseTo(30, 2);
    expect(cartSubtotal(lines)).toBe(200);
  });
});
