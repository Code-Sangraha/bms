import type { AttendanceRecord } from "@/handlers/attendance";

export type AttendanceStatus = "not_clocked_in" | "clocked_in" | "clocked_out" | "loading";

export type LocalAttendanceSnapshot = Pick<
  AttendanceRecord,
  | "id"
  | "employeeId"
  | "userId"
  | "clockIn"
  | "clockOut"
  | "hoursWorked"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

const LOCAL_ATTENDANCE_PREFIX = "bms_attendance_today";

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
      status: typeof parsed.status === "boolean" ? parsed.status : true,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}
