import { describe, expect, it } from "vitest";
import { buildInventoryPurchasePayload } from "./inventoryPurchase";

describe("inventory purchase payload", () => {
  it("derives full-payment defaults", () => {
    expect(buildInventoryPurchasePayload({}, { quantity: 10, buyingPrice: 12 })).toEqual({
      ok: true,
      data: { totalAmount: 120, paidAmount: 120, dueAmount: 0, paymentStatus: "FULL" },
    });
  });
  it("allows partial payment when amounts balance", () => {
    expect(buildInventoryPurchasePayload({ paidAmount: "40", dueAmount: "20", paymentStatus: "PARTIAL" }, { quantity: 5, buyingPrice: 12 })).toMatchObject({ ok: true });
  });
  it("rejects overpayment and inconsistent due amounts", () => {
    expect(buildInventoryPurchasePayload({ paidAmount: "121" }, { quantity: 10, buyingPrice: 12 }).ok).toBe(false);
    expect(buildInventoryPurchasePayload({ paidAmount: "40", dueAmount: "30" }, { quantity: 5, buyingPrice: 12 }).ok).toBe(false);
  });
  it("supports zero-quantity opening items", () => {
    expect(buildInventoryPurchasePayload({}, { quantity: 0, buyingPrice: 12 })).toMatchObject({ ok: true, data: { totalAmount: 0, paidAmount: 0, dueAmount: 0 } });
  });
});