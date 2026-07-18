import type { InventoryItem, InventoryMovement, OpeningClosingRow } from "@/handlers/itemInventory";

export type InventoryStockFilter = "all" | "low" | "out";
export type InventoryStatusFilter = "all" | "active" | "inactive";
export type InventorySort = "name-asc" | "name-desc" | "quantity-asc" | "quantity-desc";
export type MovementSort = "newest" | "oldest" | "quantity-asc" | "quantity-desc";

export function isLowStock(item: Pick<InventoryItem, "quantity" | "lowStockAlertQuantity">): boolean {
  return item.quantity <= item.lowStockAlertQuantity;
}

export function getStockState(
  item: Pick<InventoryItem, "quantity" | "lowStockAlertQuantity">
): "out" | "low" | "healthy" {
  if (item.quantity === 0) return "out";
  return isLowStock(item) ? "low" : "healthy";
}

export function filterAndSortInventoryItems(
  items: InventoryItem[],
  options: {
    search?: string;
    categoryId?: string;
    status?: InventoryStatusFilter;
    stock?: InventoryStockFilter;
    sort?: InventorySort;
  }
): InventoryItem[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? "";
  const result = items.filter((item) => {
    if (search && !`${item.name} ${item.category.name} ${item.unit.name} ${item.unit.symbol}`.toLocaleLowerCase().includes(search)) return false;
    if (options.categoryId && options.categoryId !== "all" && item.category.id !== options.categoryId) return false;
    if (options.status === "active" && !item.status) return false;
    if (options.status === "inactive" && item.status) return false;
    if (options.stock && options.stock !== "all" && getStockState(item) !== options.stock) return false;
    return true;
  });
  const sort = options.sort ?? "name-asc";
  return result.sort((a, b) => {
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "quantity-asc") return a.quantity - b.quantity;
    if (sort === "quantity-desc") return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

export function filterAndSortMovements(
  movements: InventoryMovement[],
  options: { search?: string; type?: string; sort?: MovementSort }
): InventoryMovement[] {
  const search = options.search?.trim().toLocaleLowerCase() ?? "";
  const result = movements.filter((movement) => {
    if (options.type && options.type !== "all" && movement.type !== options.type) return false;
    if (!search) return true;
    return `${movement.item.name} ${movement.item.category.name} ${movement.item.unit.name} ${movement.note ?? ""}`
      .toLocaleLowerCase()
      .includes(search);
  });
  const sort = options.sort ?? "newest";
  return result.sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (sort === "quantity-asc") return a.quantity - b.quantity;
    if (sort === "quantity-desc") return b.quantity - a.quantity;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function getNetMovement(row: Pick<OpeningClosingRow, "openingStock" | "closingStock">): number {
  return row.closingStock - row.openingStock;
}