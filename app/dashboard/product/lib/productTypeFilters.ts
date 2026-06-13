import type { Product } from "@/handlers/product";
import type { ProductType } from "@/handlers/productType";

export const PROCESSED_PRODUCT_TYPE_NAMES = ["processed"] as const;

/** Matches backend GET /waste/get: product type name contains "waste" (case-insensitive). */
export function isWasteProductTypeName(name: string): boolean {
  return name.toLowerCase().includes("waste");
}

export function isProcessedProductTypeName(name: string): boolean {
  return PROCESSED_PRODUCT_TYPE_NAMES.includes(
    name.toLowerCase() as typeof PROCESSED_PRODUCT_TYPE_NAMES[number]
  );
}

export function productTypeNameLower(product: Product): string {
  if (typeof product.productType === "object" && typeof product.productType?.name === "string") {
    return product.productType.name.toLowerCase();
  }
  return "";
}

export function getWasteTypeIds(productTypes: ProductType[]): Set<string> {
  const ids = new Set<string>();
  productTypes.forEach((pt) => {
    if (isWasteProductTypeName(pt.name)) ids.add(pt.id);
  });
  return ids;
}

export function getProcessedTypeIds(productTypes: ProductType[]): Set<string> {
  const ids = new Set<string>();
  productTypes.forEach((pt) => {
    if (isProcessedProductTypeName(pt.name)) ids.add(pt.id);
  });
  return ids;
}

export function isWasteProduct(product: Product, wasteTypeIds: Set<string>): boolean {
  const typeName = productTypeNameLower(product);
  return wasteTypeIds.has(product.productTypeId) || isWasteProductTypeName(typeName);
}

export function isProcessedNonWasteProduct(
  product: Product,
  processedTypeIds: Set<string>,
  wasteTypeIds: Set<string>
): boolean {
  if (isWasteProduct(product, wasteTypeIds)) return false;
  const typeName = productTypeNameLower(product);
  return processedTypeIds.has(product.productTypeId) || isProcessedProductTypeName(typeName);
}

export function filterWasteProducts(products: Product[], wasteTypeIds: Set<string>): Product[] {
  return products.filter((p) => isWasteProduct(p, wasteTypeIds));
}

export function filterProcessedNonWasteProducts(
  products: Product[],
  processedTypeIds: Set<string>,
  wasteTypeIds: Set<string>
): Product[] {
  return products.filter((p) => isProcessedNonWasteProduct(p, processedTypeIds, wasteTypeIds));
}
