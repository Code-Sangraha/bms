import { getWasteProducts, type WasteProduct } from "@/handlers/product";
import { logWasteProductsDebug, warnWasteProductsDebug } from "@/lib/wasteProductsDebug";

/** Trim and collapse internal whitespace for stable name comparison. */
export function normalizeWasteProductName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function wasteProductNameExists(
  products: WasteProduct[],
  name: string,
  outletId?: string | null
): boolean {
  const normalized = normalizeWasteProductName(name);
  if (!normalized) return false;
  return products.some((product) => {
    if (outletId && product.outletId !== outletId) return false;
    return normalizeWasteProductName(product.name) === normalized;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RefreshWasteProductsResult = {
  products: WasteProduct[];
  found: boolean;
};

/**
 * After create, backend may still be writing rows. Poll lightly — avoid hammering GET
 * (rapid requests can trip CORS / rate limits on production API from localhost).
 */
export async function refreshWasteProductsAfterCreate(
  expectedName: string,
  options?: { maxAttempts?: number; intervalMs?: number }
): Promise<RefreshWasteProductsResult> {
  const normalized = normalizeWasteProductName(expectedName);
  if (!normalized) return { products: [], found: false };

  const maxAttempts = options?.maxAttempts ?? 3;
  const intervalMs = options?.intervalMs ?? 1200;

  logWasteProductsDebug("refreshWasteProductsAfterCreate: start", {
    expectedName,
    maxAttempts,
    intervalMs,
  });

  let lastProducts: WasteProduct[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(intervalMs);
    }

    const result = await getWasteProducts();
    if (!result.ok) {
      warnWasteProductsDebug("refreshWasteProductsAfterCreate: fetch failed", {
        attempt: attempt + 1,
        status: result.status,
        error: result.error,
      });
      continue;
    }

    lastProducts = result.data;
    const found = result.data.some(
      (product) => normalizeWasteProductName(product.name) === normalized
    );

    logWasteProductsDebug("refreshWasteProductsAfterCreate: attempt", {
      attempt: attempt + 1,
      count: result.data.length,
      found,
    });

    if (found) {
      return { products: result.data, found: true };
    }
  }

  warnWasteProductsDebug("refreshWasteProductsAfterCreate: name not visible yet", {
    expectedName,
    lastCount: lastProducts.length,
  });
  return { products: lastProducts, found: false };
}
