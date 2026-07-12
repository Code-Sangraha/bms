import { describe, expect, it } from "vitest";
import { parseCustomerSalesSummaryForTest } from "./sale";

describe("customer sales summary normalization", () => {
  it("parses the updated customer summary envelope", () => {
    const summary = parseCustomerSalesSummaryForTest({
      success: true,
      data: {
        totalWeightBought: 25,
        totalAmountSpent: 5200,
        totalTransactions: 3,
        sales: [
          {
            id: "sale-1",
            transactionId: "TXN-001",
            name: "Ram Customer",
            weight: 12,
            amount: 2400,
            product: { id: "product-1", name: "Product name" },
            outlet: { id: "outlet-1", name: "Outlet name" },
          },
        ],
      },
    });

    expect(summary.totalWeightBought).toBe(25);
    expect(summary.totalAmountSpent).toBe(5200);
    expect(summary.totalTransactions).toBe(3);
    expect(summary.sales).toHaveLength(1);
    expect(summary.sales[0].transactionId).toBe("TXN-001");
  });

  it("falls back to derived totals for array-shaped responses", () => {
    const summary = parseCustomerSalesSummaryForTest([
      { id: "sale-1", weight: 3, amount: 300 },
      { id: "sale-2", weight: 2, totalAmount: 250 },
    ]);

    expect(summary.totalWeightBought).toBe(5);
    expect(summary.totalAmountSpent).toBe(550);
    expect(summary.totalTransactions).toBe(2);
  });

  it("derives customer totals from grouped processed sale items", () => {
    const summary = parseCustomerSalesSummaryForTest({
      success: true,
      data: {
        sales: [
          {
            transactionId: "TXN-NABIN-001",
            name: "Nabin Rai",
            contact: "9841",
            items: [
              { product: { name: "Buff item" }, weight: 1.5, amount: 1200 },
              { product: { name: "Another item" }, weight: 2, amount: 1800 },
            ],
          },
        ],
      },
    });

    expect(summary.totalWeightBought).toBe(3.5);
    expect(summary.totalAmountSpent).toBe(3000);
    expect(summary.totalTransactions).toBe(1);
    expect(summary.sales[0].weight).toBe(3.5);
    expect(summary.sales[0].totalAmount).toBe(3000);
  });
});


