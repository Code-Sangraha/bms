/**
 * Placeholder rows for inventory detail sections until backend APIs exist.
 * Replace with real useQuery hooks wired to handlers when endpoints are ready.
 */

export type MockStorageRow = { date: string; quantity: string; note: string };
export type MockConsumptionRow = { date: string; type: string; quantity: string };

export const DUMMY_STORAGE_ROWS: MockStorageRow[] = [
  { date: "2026-04-02", quantity: "120 kg", note: "Sample restock" },
  { date: "2026-04-09", quantity: "45 kg", note: "Sample adjustment" },
];

export const DUMMY_CONSUMPTION_ROWS: MockConsumptionRow[] = [
  { date: "2026-04-10", type: "Consumed", quantity: "12 kg" },
  { date: "2026-04-11", type: "Waste", quantity: "2 kg" },
];

/** Fallback rows for waste tab when API returns nothing (same shape as API entries). */
export const DUMMY_WASTE_TABLE_ROWS: { date: string; quantity: number; remarks: string }[] = [
  { date: "2026-04-03", quantity: 5, remarks: "Sample" },
  { date: "2026-04-07", quantity: 3, remarks: "Sample" },
];

/** Appended to waste textarea when API returns no rows (demo UX). */
export const DUMMY_WASTE_LINES_TEXT =
  "2026-04-03 · 5 · Sample entry\n2026-04-07 · 3 · Sample entry";

/**
 * When true, empty successful waste responses show {@link DUMMY_WASTE_LINES_TEXT} after the "no records" line.
 * Set to false to only show real API data.
 */
export const SHOW_DUMMY_WASTE_WHEN_EMPTY = false;
