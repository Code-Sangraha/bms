export const NEPAL_TIME_ZONE = "Asia/Kathmandu";
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function getNepalDateKey(value: Date = new Date()): string {
  return new Date(value.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10);
}

export function addCalendarDays(dateKey: string, days: number): string | null {
  const parsed = parseDateKey(dateKey);
  if (!parsed || !Number.isInteger(days)) return null;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
    .toISOString()
    .slice(0, 10);
}

export function startOfNepalDayIso(dateKey: string): string | null {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  return new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day) - NEPAL_OFFSET_MS
  ).toISOString();
}

export function inclusiveNepalRangeToIso(
  fromDateKey: string,
  visibleToDateKey: string
): { from: string; to: string } | null {
  const from = startOfNepalDayIso(fromDateKey);
  const nextDay = addCalendarDays(visibleToDateKey, 1);
  const to = nextDay ? startOfNepalDayIso(nextDay) : null;
  if (!from || !to || from >= to) return null;
  return { from, to };
}

export function getLastNepalCalendarDays(
  count: number,
  now: Date = new Date()
): { from: string; to: string } {
  const to = getNepalDateKey(now);
  return { from: addCalendarDays(to, -(Math.max(1, Math.floor(count)) - 1)) ?? to, to };
}

export function formatNepalDateTime(value: string | Date, locale = "en-NP"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: NEPAL_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}