import type { LivestockItem, Product } from "@/handlers/product";

export type LivestockDetailLocationState = {
  itemSnapshot?: LivestockItem;
};

export type ProcessedDetailLocationState = {
  productSnapshot?: Product;
};
