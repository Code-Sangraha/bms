/** YYYY-MM-DD from a Date in local time. */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First 10 chars as YYYY-MM-DD for range compare; unknown shapes sort as empty. */
export function rowDateKey(date: string): string {
  if (!date || typeof date !== "string") return "";
  const s = date.trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function isDateInRange(date: string, from: string, to: string): boolean {
  const k = rowDateKey(date);
  if (!k) return false;
  return k >= from && k <= to;
}
