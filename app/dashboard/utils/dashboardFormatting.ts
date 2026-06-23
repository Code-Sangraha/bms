export function truncateToTwoDecimals(value: number): number {
  return Math.trunc(value * 100) / 100;
}

export function formatDashboardMoney(value: number): string {
  if (!Number.isFinite(value)) return "Rs.0.00";
  return `Rs.${truncateToTwoDecimals(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDashboardDecimal(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = truncateToTwoDecimals(value).toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

export function formatDashboardExpenseDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString();
}

export function formatDashboardAttendanceHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function expensePaymentStatusLabel(
  status: "ADVANCE" | "PARTIAL" | "FULL",
  t: (key: string) => string
): string {
  switch (status) {
    case "ADVANCE":
      return t("Advance");
    case "PARTIAL":
      return t("Partial");
    case "FULL":
      return t("Full");
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
