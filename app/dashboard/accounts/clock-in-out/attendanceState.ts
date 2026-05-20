import type { AttendanceRecord } from "@/handlers/attendance";

export type AttendanceStatus = "not_clocked_in" | "clocked_in" | "clocked_out" | "final_clocked_out" | "loading";

export type LocalAttendanceSnapshot = Pick<
  AttendanceRecord,
  | "id"
  | "employeeId"
  | "userId"
  | "clockIn"
  | "clockOut"
  | "hoursWorked"
  | "isClockedIn"
  | "status"
  | "createdAt"
  | "updatedAt"
> & {
  isFinalClockedOut?: boolean;
};

const LOCAL_ATTENDANCE_PREFIX = "bms_attendance_today";
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const NEPAL_AUTO_CLOCK_OUT_HOUR = 23;

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();
}

export function nepalAutoClockOutDeadline(now = new Date()): Date {
  const nepalNow = new Date(now.getTime() + NEPAL_OFFSET_MS);
  const y = nepalNow.getUTCFullYear();
  const m = nepalNow.getUTCMonth();
  const d = nepalNow.getUTCDate();
  return new Date(Date.UTC(y, m, d, NEPAL_AUTO_CLOCK_OUT_HOUR, 0, 0, 0) - NEPAL_OFFSET_MS);
}

export function msUntilNepalAutoClockOut(now = new Date()): number {
  return nepalAutoClockOutDeadline(now).getTime() - now.getTime();
}

export function isClockInToday(clockInIso: string, now = new Date()): boolean {
  const clockIn = new Date(clockInIso);
  if (Number.isNaN(clockIn.getTime())) return false;
  return isSameLocalCalendarDay(clockIn, now);
}

function normalizeId(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function rowBelongsToCurrentIdentity(
  row: AttendanceRecord | LocalAttendanceSnapshot,
  userId: string | null | undefined,
  employeeId: string | null | undefined
): boolean {
  const uid = normalizeId(userId);
  const eid = normalizeId(employeeId);
  const rowUserId = normalizeId(row.userId);
  const rowEmployeeId = normalizeId(row.employeeId);
  return (!!uid && rowUserId === uid) || (!!eid && rowEmployeeId === eid);
}

function isOpenAttendance(row: AttendanceRecord | LocalAttendanceSnapshot): boolean {
  if (typeof row.isClockedIn === "boolean") return row.isClockedIn;
  return row.clockOut == null || row.clockOut === "";
}

function timestampValue(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function rowSortTime(row: AttendanceRecord | LocalAttendanceSnapshot): number {
  return Math.max(
    timestampValue(row.updatedAt),
    timestampValue(row.clockOut),
    timestampValue(row.clockIn),
    timestampValue(row.createdAt)
  );
}

export function findTodayAttendanceForIdentity(
  rows: readonly AttendanceRecord[],
  identity: { userId?: string | null; employeeId?: string | null },
  now = new Date()
): AttendanceRecord | undefined {
  const matches = rows.filter(
    (r) =>
      r.clockIn &&
      isClockInToday(r.clockIn, now) &&
      rowBelongsToCurrentIdentity(r, identity.userId, identity.employeeId)
  );
  if (matches.length === 0) return undefined;

  const openRows = matches.filter(isOpenAttendance);
  const candidates = openRows.length > 0 ? openRows : matches;
  return candidates.reduce((latest, row) => (rowSortTime(row) > rowSortTime(latest) ? row : latest));
}

export function getAttendanceStatus(
  record: AttendanceRecord | LocalAttendanceSnapshot | null | undefined
): Exclude<AttendanceStatus, "loading"> {
  if (!record?.clockIn) return "not_clocked_in";
  if ("isFinalClockedOut" in record && record.isFinalClockedOut) return "final_clocked_out";
  if (typeof record.isClockedIn === "boolean") return record.isClockedIn ? "clocked_in" : "clocked_out";
  return record.clockOut == null || record.clockOut === "" ? "clocked_in" : "clocked_out";
}

export function localAttendanceStorageKey(userId: string, date = new Date()): string {
  return `${LOCAL_ATTENDANCE_PREFIX}:${userId}:${toLocalDateKey(date)}`;
}

export function saveLocalAttendanceSnapshot(
  storage: Pick<Storage, "setItem">,
  userId: string | null | undefined,
  record: AttendanceRecord | LocalAttendanceSnapshot | null | undefined,
  now = new Date()
): void {
  const uid = normalizeId(userId);
  if (!uid || !record?.id || !record.clockIn) return;
  const snapshot: LocalAttendanceSnapshot = {
    id: record.id,
    employeeId: record.employeeId ?? null,
    userId: record.userId ?? null,
    clockIn: record.clockIn,
    clockOut: record.clockOut ?? null,
    hoursWorked: record.hoursWorked ?? null,
    isClockedIn: record.isClockedIn,
    isFinalClockedOut: "isFinalClockedOut" in record ? record.isFinalClockedOut : undefined,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  storage.setItem(localAttendanceStorageKey(uid, now), JSON.stringify(snapshot));
}

export function readLocalAttendanceSnapshot(
  storage: Pick<Storage, "getItem">,
  userId: string | null | undefined,
  now = new Date()
): LocalAttendanceSnapshot | null {
  const uid = normalizeId(userId);
  if (!uid) return null;
  const raw = storage.getItem(localAttendanceStorageKey(uid, now));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalAttendanceSnapshot>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.clockIn !== "string" ||
      !isClockInToday(parsed.clockIn, now)
    ) {
      return null;
    }
    return {
      id: parsed.id,
      employeeId: parsed.employeeId ?? null,
      userId: parsed.userId ?? null,
      clockIn: parsed.clockIn,
      clockOut: parsed.clockOut ?? null,
      hoursWorked: typeof parsed.hoursWorked === "number" ? parsed.hoursWorked : null,
      isClockedIn: typeof parsed.isClockedIn === "boolean" ? parsed.isClockedIn : undefined,
      isFinalClockedOut: typeof parsed.isFinalClockedOut === "boolean" ? parsed.isFinalClockedOut : undefined,
      status: typeof parsed.status === "boolean" ? parsed.status : true,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}
