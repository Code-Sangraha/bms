export function formatStockDateLabel(dateString: string): string {
  const d = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function qtyWithUnit(quantity: number, unit: string): string {
  const u = unit.trim();
  return u ? `${quantity} ${u}` : String(quantity);
}
