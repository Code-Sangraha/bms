import { describe, expect, it } from "vitest";
import {
  readCustomerPurchaseTotals,
  recordCustomerPurchaseTotals,
} from "./customerPurchaseTotalsStorage";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("temporary customer purchase totals storage", () => {
  it("creates a new customer total from one purchase", () => {
    const storage = createMemoryStorage();

    recordCustomerPurchaseTotals(
      {
        name: "Ram Customer",
        contact: "9841",
        outletId: "outlet-1",
        weightBought: 2,
        amountSpent: 2000,
      },
      storage
    );

    expect(
      readCustomerPurchaseTotals(
        { name: "Ram Customer", contact: "9841", outletId: "outlet-1" },
        storage
      )
    ).toMatchObject({
      name: "Ram Customer",
      contact: "9841",
      outletId: "outlet-1",
      totalWeightBought: 2,
      totalAmountSpent: 2000,
      totalTransactions: 1,
    });
  });

  it("adds a second purchase to the same outlet/contact", () => {
    const storage = createMemoryStorage();
    const customer = {
      name: "Ram Customer",
      contact: "98 41",
      outletId: "outlet-1",
    };

    recordCustomerPurchaseTotals(
      { ...customer, weightBought: 2, amountSpent: 2000 },
      storage
    );
    recordCustomerPurchaseTotals(
      { ...customer, weightBought: 1.5, amountSpent: 1200 },
      storage
    );

    expect(readCustomerPurchaseTotals(customer, storage)).toMatchObject({
      totalWeightBought: 3.5,
      totalAmountSpent: 3200,
      totalTransactions: 2,
    });
  });

  it("keeps the same contact in different outlets separate", () => {
    const storage = createMemoryStorage();

    recordCustomerPurchaseTotals(
      {
        name: "Ram",
        contact: "9841",
        outletId: "outlet-1",
        weightBought: 2,
        amountSpent: 2000,
      },
      storage
    );
    recordCustomerPurchaseTotals(
      {
        name: "Ram",
        contact: "9841",
        outletId: "outlet-2",
        weightBought: 4,
        amountSpent: 5000,
      },
      storage
    );

    expect(
      readCustomerPurchaseTotals(
        { name: "Ram", contact: "9841", outletId: "outlet-1" },
        storage
      )
    ).toMatchObject({ totalWeightBought: 2, totalAmountSpent: 2000 });
    expect(
      readCustomerPurchaseTotals(
        { name: "Ram", contact: "9841", outletId: "outlet-2" },
        storage
      )
    ).toMatchObject({ totalWeightBought: 4, totalAmountSpent: 5000 });
  });

  it("falls back to name when contact is missing", () => {
    const storage = createMemoryStorage();

    recordCustomerPurchaseTotals(
      {
        name: "  Ram   Customer ",
        contact: "",
        outletId: "outlet-1",
        weightBought: 2,
        amountSpent: 2000,
      },
      storage
    );

    expect(
      readCustomerPurchaseTotals(
        { name: "ram customer", outletId: "outlet-1" },
        storage
      )
    ).toMatchObject({
      totalWeightBought: 2,
      totalAmountSpent: 2000,
      totalTransactions: 1,
    });
  });

  it("ignores invalid localStorage JSON safely", () => {
    const storage = createMemoryStorage();
    storage.setItem("bms:temp-customer-purchase-totals:v1", "{not valid json");

    expect(
      readCustomerPurchaseTotals(
        { name: "Ram", contact: "9841", outletId: "outlet-1" },
        storage
      )
    ).toBeNull();

    recordCustomerPurchaseTotals(
      {
        name: "Ram",
        contact: "9841",
        outletId: "outlet-1",
        weightBought: 2,
        amountSpent: 2000,
      },
      storage
    );

    expect(
      readCustomerPurchaseTotals(
        { name: "Ram", contact: "9841", outletId: "outlet-1" },
        storage
      )
    ).toMatchObject({ totalWeightBought: 2, totalAmountSpent: 2000 });
  });
});
