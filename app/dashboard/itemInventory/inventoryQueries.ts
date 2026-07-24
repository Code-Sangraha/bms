import type { QueryClient } from "@tanstack/react-query";

export const inventoryQueryKeys = {
  all: ["item-inventory"] as const,
  outlets: ["item-inventory", "outlets"] as const,
  items: (outletId: string) => ["item-inventory", outletId, "items"] as const,
  categories: (outletId: string) => ["item-inventory", outletId, "categories"] as const,
  units: (outletId: string) => ["item-inventory", outletId, "units"] as const,
  movements: (outletId: string) => ["item-inventory", outletId, "movements"] as const,
  openingClosing: (outletId: string) => ["item-inventory", outletId, "opening-closing"] as const,
};

export type InventoryCache = keyof Pick<
  typeof inventoryQueryKeys,
  "items" | "categories" | "units" | "movements" | "openingClosing"
>;

export function invalidateInventoryCaches(
  queryClient: QueryClient,
  outletId: string,
  caches: InventoryCache[] = ["items", "categories", "units", "movements", "openingClosing"]
): Promise<unknown[]> {
  return Promise.all(
    caches.map((cache) =>
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys[cache](outletId) })
    )
  );
}
