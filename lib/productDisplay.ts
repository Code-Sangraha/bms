import type { Outlet } from "@/handlers/outlet";
import type { Product } from "@/handlers/product";

/** Resolve outlet/plant name from nested product relation or fallback list */
export function outletLabelFromProduct(
  product: Product,
  outletsList: Outlet[]
): string {
  if (typeof product.outlet === "object" && product.outlet?.name) {
    return product.outlet.name;
  }
  return outletsList.find((o) => o.id === product.outletId)?.name ?? "";
}

/** e.g. "Pork 1 thigh (Dharan outlet)" */
export function formatNameWithOutlet(
  primaryName: string,
  outletName: string
): string {
  const trimmed = outletName.trim();
  if (!trimmed || trimmed === "—") return primaryName;
  return `${primaryName} (${trimmed})`;
}
