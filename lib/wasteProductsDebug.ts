const PREFIX = "[WasteProducts]";

/** Enabled in Vite dev builds, or when `localStorage.DEBUG_WASTE_PRODUCTS === "1"`. */
export function isWasteProductsDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("DEBUG_WASTE_PRODUCTS") === "1";
  } catch {
    return false;
  }
}

export function logWasteProductsDebug(message: string, detail?: unknown): void {
  if (!isWasteProductsDebugEnabled()) return;
  if (detail !== undefined) {
    console.log(PREFIX, message, detail);
  } else {
    console.log(PREFIX, message);
  }
}

export function warnWasteProductsDebug(message: string, detail?: unknown): void {
  if (!isWasteProductsDebugEnabled()) return;
  if (detail !== undefined) {
    console.warn(PREFIX, message, detail);
  } else {
    console.warn(PREFIX, message);
  }
}
