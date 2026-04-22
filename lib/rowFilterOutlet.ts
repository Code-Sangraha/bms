import type { Outlet } from "@/handlers/outlet";
import type { ProcessingPlant } from "@/handlers/processingPlant";

/**
 * When a plant’s merged `outletId` comes from the assigned user, it can still point at the
 * wrong outlet (e.g. Main) while product rows use the real branch outlet. Match an outlet
 * by name to the plant name (e.g. "Dharan" → "Dharan Outlet") when unambiguous.
 */
function outletIdFromPlantNameMatch(plant: ProcessingPlant, outlets: Outlet[]): string | null {
  const name = plant.name?.trim();
  if (!name || outlets.length === 0) return null;
  const lower = name.toLowerCase();
  const primaryToken =
    lower.split(/[\s-]+/).find((t) => t.length >= 3) ?? (lower.length >= 3 ? lower : "");

  if (!primaryToken) return null;

  const candidates = outlets.filter((o) => {
    const on = o.name.toLowerCase();
    if (on.includes(lower) || lower.includes(on)) return true;
    if (on.includes(primaryToken)) return true;
    if (lower.replace(/[^a-z0-9]/g, "") === on.replace(/[^a-z0-9]/g, "")) return true;
    return false;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  // Prefer a branch that plausibly matches the plant, not a generic "Main" outlet, when
  // the plant name is not "main".
  if (!lower.includes("main") && !primaryToken.includes("main")) {
    const nonMain = candidates.filter(
      (o) => !o.name.toLowerCase().includes("main")
    );
    if (nonMain.length === 1) return nonMain[0].id;
  }

  // Best overlap: name contains the most of `lower`
  const ranked = candidates
    .map((o) => ({
      o,
      s: o.name.toLowerCase().includes(lower) ? 2 : o.name.toLowerCase().includes(primaryToken) ? 1 : 0,
    }))
    .sort((a, b) => b.s - a.s);
  if (ranked[0].s > 0) return ranked[0].o.id;

  return null;
}

/**
 * `outletId` for Highland context and drawer `?outletId=` for a plant rail button.
 * Uses the same resolution as list filters (name match → branch outlet, not the user’s wrong default).
 */
export function resolvedScopeOutletIdForPlant(
  plant: ProcessingPlant,
  outlets: Outlet[],
  mergedPlants: ProcessingPlant[]
): string | null {
  return resolveRowFilterOutletId(plant.id, outlets, mergedPlants) ?? plant.outletId ?? null;
}

/**
 * Maps URL `?outletId=` to the id used on API rows (`product.outletId`, `sale.outletId`, etc.).
 * When the scope is a processing-plant row id, row data still uses the plant’s resolved `outletId`.
 */
export function resolveRowFilterOutletId(
  scopedId: string | null,
  outlets: Outlet[],
  mergedPlants: ProcessingPlant[]
): string | null {
  if (!scopedId) return null;
  if (outlets.some((o) => o.id === scopedId)) return scopedId;
  const plant = mergedPlants.find((p) => p.id === scopedId || p.outletId === scopedId);
  if (plant) {
    const fromName = outletIdFromPlantNameMatch(plant, outlets);
    if (fromName) return fromName;
    if (plant.outletId) return plant.outletId;
  }
  return scopedId;
}

/** Human-readable label for the scoped outlet / plant in filter UI. */
export function resolveScopeLabel(
  scopedId: string,
  rowFilterOutletId: string,
  outlets: Outlet[],
  mergedPlants: ProcessingPlant[]
): string {
  const byOutlet = outlets.find((o) => o.id === rowFilterOutletId)?.name;
  if (byOutlet) return byOutlet;
  const plant = mergedPlants.find(
    (p) => p.id === scopedId || p.outletId === scopedId || p.outletId === rowFilterOutletId
  );
  if (plant?.name) return plant.name;
  return rowFilterOutletId;
}
