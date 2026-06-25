import { truncateToTwoDecimals } from "@/app/dashboard/utils/dashboardFormatting";

export function formatStockDateLabel(dateString: string): string {
  const d = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatStockQty(value: number): string {
  return truncateToTwoDecimals(value).toFixed(2);
}

export function formatStockQtyOrDash(value: number | null): string {
  return value === null ? "\u2014" : formatStockQty(value);
}

export function qtyWithUnit(quantity: number | null, unit: string): string {
  if (quantity === null) return "\u2014";
  const formatted = formatStockQty(quantity);
  const u = unit.trim();
  return u ? `${formatted} ${u}` : formatted;
}
