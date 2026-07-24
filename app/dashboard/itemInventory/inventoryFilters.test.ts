import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { paginate } from "@/app/hooks/usePagination";
import type { InventoryItem, InventoryMovement } from "@/handlers/itemInventory";
import { filterAndSortInventoryItems, filterAndSortMovements, getNetMovement, getStockState, isLowStock } from "./inventoryFilters";
import { invalidateInventoryCaches, inventoryQueryKeys } from "./inventoryQueries";

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return { id: "item", name: "Rice", quantity: 5, buyingPrice: 10, sellingPrice: 12, lowStockAlertQuantity: 5, status: true, category: { id: "food", name: "Food" }, unit: { id: "kg", name: "Kilogram", symbol: "kg" }, ...overrides };
}

describe("inventory client-side behavior", () => {
  it("uses the inclusive low-stock boundary while keeping zero as out of stock", () => {
    expect(isLowStock(item({ quantity: 5, lowStockAlertQuantity: 5 }))).toBe(true);
    expect(getStockState(item({ quantity: 0 }))).toBe("out");
    expect(getStockState(item({ quantity: 5 }))).toBe("low");
    expect(getStockState(item({ quantity: 6 }))).toBe("healthy");
  });

  it("filters and sorts the complete item array locally", () => {
    const rows = [item({ id: "rice", name: "Rice", quantity: 5 }), item({ id: "oil", name: "Oil", quantity: 0 }), item({ id: "soap", name: "Soap", category: { id: "home", name: "Home" }, quantity: 8 })];
    expect(filterAndSortInventoryItems(rows, { categoryId: "food", stock: "low", sort: "quantity-desc" }).map((row) => row.id)).toEqual(["rice"]);
    expect(filterAndSortInventoryItems(rows, { search: "home" }).map((row) => row.id)).toEqual(["soap"]);
  });

  it("paginates the already-filtered client array", () => {
    const rows = Array.from({ length: 25 }, (_, index) => item({ id: String(index), name: `Item ${index}` }));
    expect(paginate(rows, 10, 20)).toHaveLength(10);
    expect(paginate(rows, 20, 30).map((row) => row.id)).toEqual(["20", "21", "22", "23", "24"]);
  });
  it("filters movement type and search locally", () => {
    const base = { itemId: "rice", quantity: 2, resultingQuantity: 7, createdAt: "2026-07-19T00:00:00.000Z", item: item({ id: "rice" }) };
    const rows = [{ ...base, id: "r", type: "RESTOCK", note: "supplier" }, { ...base, id: "d", type: "DEDUCT", note: "kitchen" }] as InventoryMovement[];
    expect(filterAndSortMovements(rows, { type: "DEDUCT", search: "kitchen" }).map((row) => row.id)).toEqual(["d"]);
  });

  it("calculates net movement from closing minus opening", () => {
    expect(getNetMovement({ openingStock: 0, closingStock: 10 })).toBe(10);
    expect(getNetMovement({ openingStock: 12, closingStock: 8 })).toBe(-4);
  });

  it("invalidates only the requested inventory caches", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await invalidateInventoryCaches({ invalidateQueries } as unknown as QueryClient, "outlet-1", ["items", "movements"]);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: inventoryQueryKeys.items("outlet-1") });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: inventoryQueryKeys.movements("outlet-1") });
  });
});
