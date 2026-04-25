/** Query param used across the app to lock list/analytics views to one outlet (e.g. processing plant scope). */
export const OUTLET_SCOPE_SEARCH_PARAM = "outletId";

export const HIGHLAND_CONTEXT_STORAGE_KEY = "bms_highland_context";

/** Dispatched on `window` when Highland / sub-outlet context is written (same-tab; other listeners can re-read storage). */
export const BMS_HIGHLAND_CONTEXT_EVENT = "bms_highland_context_changed";

export type HighlandStoredContext =
  | { mode: "main" }
  | { mode: "plant"; plantId: string; outletId: string; plantName: string };

export function readOutletScopeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const v = params.get(OUTLET_SCOPE_SEARCH_PARAM);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Build `pathname` + search string, setting or removing outlet scope; other query keys from `baseSearch` are kept. */
export function buildPathWithOutletScope(
  pathname: string,
  outletId: string | null,
  baseSearch = ""
): string {
  const params = new URLSearchParams(baseSearch.replace(/^\?/, ""));
  if (outletId) {
    params.set(OUTLET_SCOPE_SEARCH_PARAM, outletId);
  } else {
    params.delete(OUTLET_SCOPE_SEARCH_PARAM);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function readHighlandContextFromStorage(): HighlandStoredContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HIGHLAND_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (data == null || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (o.mode === "main") return { mode: "main" };
    if (
      o.mode === "plant" &&
      typeof o.plantId === "string" &&
      typeof o.outletId === "string" &&
      typeof o.plantName === "string"
    ) {
      return {
        mode: "plant",
        plantId: o.plantId,
        outletId: o.outletId,
        plantName: o.plantName,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * For list row filters: `?outletId=` wins. If absent, sub-outlet (Highland) plant mode uses
 * the resolved `outletId` stored in session (same as product `outletId` for that plant).
 */
export function getRowScopeIdFromUrlOrHighlandSearch(search: string): string | null {
  const fromUrl = readOutletScopeFromSearch(search);
  if (fromUrl) return fromUrl;
  if (typeof globalThis.window === "undefined") return null;
  const highland = readHighlandContextFromStorage();
  if (highland?.mode === "plant" && highland.outletId.trim() !== "")
    return highland.outletId;
  return null;
}

export function writeHighlandContextToStorage(ctx: HighlandStoredContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(HIGHLAND_CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
    try {
      window.dispatchEvent(new Event(BMS_HIGHLAND_CONTEXT_EVENT));
    } catch {
      // ignore
    }
  } catch {
    // ignore quota / private mode
  }
}
