import type { Product } from "@/handlers/product";

/** Quantity fallback when `weight` is missing (legacy rows). */
export function getProcessedQuantity(product: Product): number {
  const raw = product.quantity;
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : 0;
}

/** Stock weight for caps and opening/closing; prefers `weight`, falls back to `quantity`. */
export function getProcessedStockWeight(product: Product): number {
  const w = product.weight;
  if (w != null) {
    const n = typeof w === "number" ? w : Number(w);
    if (Number.isFinite(n)) return n;
  }
  return getProcessedQuantity(product);
}
