import type { QueryClient } from "@tanstack/react-query";

export const inventoryQueryKeys = {
  all: ["item-inventory"] as const,
  items: ["item-inventory", "items"] as const,
  categories: ["item-inventory", "categories"] as const,
  units: ["item-inventory", "units"] as const,
  movements: ["item-inventory", "movements"] as const,
  openingClosing: ["item-inventory", "opening-closing"] as const,
};

export type InventoryCache = keyof Pick<
  typeof inventoryQueryKeys,
  "items" | "categories" | "units" | "movements" | "openingClosing"
>;

export function invalidateInventoryCaches(
  queryClient: QueryClient,
  caches: InventoryCache[] = ["items", "categories", "units", "movements", "openingClosing"]
): Promise<unknown[]> {
  return Promise.all(
    caches.map((cache) =>
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys[cache] })
    )
  );
}