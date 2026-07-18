import type { AttendanceRecord } from "@/handlers/attendance";
import { getNepalDateKey } from "@/lib/nepalTime";

export type AttendanceStatus = "not_clocked_in" | "clocked_in" | "clocked_out" | "final_clocked_out" | "loading";

export type LocalAttendanceSnapshot = Pick<
  AttendanceRecord,
  "id" | "employeeId" | "userId" | "clockIn" | "clockOut" | "hoursWorked" | "isClockedIn" | "status" | "createdAt" | "updatedAt"
> & { isFinalClockedOut?: boolean };

const ACTIVE_ATTENDANCE_PREFIX = "bms_attendance_active";

export function isClockInToday(clockInIso: string, now = new Date()): boolean {
  const clockIn = new Date(clockInIso);
  if (Number.isNaN(clockIn.getTime())) return false;
  return getNepalDateKey(clockIn) === getNepalDateKey(now);
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
  return (!!uid && normalizeId(row.userId) === uid) || (!!eid && normalizeId(row.employeeId) === eid);
}

export function isOpenAttendance(row: AttendanceRecord | LocalAttendanceSnapshot): boolean {
  if (typeof row.isClockedIn === "boolean") return row.isClockedIn;
  return row.clockOut == null || row.clockOut === "";
}

function timestampValue(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function rowSortTime(row: AttendanceRecord | LocalAttendanceSnapshot): number {
  return Math.max(timestampValue(row.updatedAt), timestampValue(row.clockOut), timestampValue(row.clockIn), timestampValue(row.createdAt));
}

export function findTodayAttendanceForIdentity(
  rows: readonly AttendanceRecord[],
  identity: { userId?: string | null; employeeId?: string | null },
  now = new Date()
): AttendanceRecord | undefined {
  const matches = rows.filter((row) => row.clockIn && isClockInToday(row.clockIn, now) && rowBelongsToCurrentIdentity(row, identity.userId, identity.employeeId));
  if (matches.length === 0) return undefined;
  const openRows = matches.filter(isOpenAttendance);
  const candidates = openRows.length > 0 ? openRows : matches;
  return candidates.reduce((latest, row) => rowSortTime(row) > rowSortTime(latest) ? row : latest);
}

export function getAttendanceStatus(
  record: AttendanceRecord | LocalAttendanceSnapshot | null | undefined
): Exclude<AttendanceStatus, "loading"> {
  if (!record?.clockIn) return "not_clocked_in";
  if ("isFinalClockedOut" in record && record.isFinalClockedOut) return "final_clocked_out";
  if (typeof record.isClockedIn === "boolean") return record.isClockedIn ? "clocked_in" : "clocked_out";
  return record.clockOut == null || record.clockOut === "" ? "clocked_in" : "clocked_out";
}

export function activeAttendanceStorageKey(userId: string): string {
  return `${ACTIVE_ATTENDANCE_PREFIX}:${normalizeId(userId)}`;
}

export function saveActiveAttendanceSnapshot(
  storage: Pick<Storage, "setItem" | "removeItem">,
  userId: string | null | undefined,
  record: AttendanceRecord | LocalAttendanceSnapshot | null | undefined
): void {
  const uid = normalizeId(userId);
  if (!uid) return;
  if (!record?.id || !record.clockIn || !isOpenAttendance(record)) {
    storage.removeItem(activeAttendanceStorageKey(uid));
    return;
  }
  const snapshot: LocalAttendanceSnapshot = {
    id: record.id,
    employeeId: record.employeeId ?? null,
    userId: record.userId ?? null,
    clockIn: record.clockIn,
    clockOut: null,
    hoursWorked: record.hoursWorked ?? null,
    isClockedIn: true,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  storage.setItem(activeAttendanceStorageKey(uid), JSON.stringify(snapshot));
}

export function readActiveAttendanceSnapshot(
  storage: Pick<Storage, "getItem">,
  userId: string | null | undefined
): LocalAttendanceSnapshot | null {
  const uid = normalizeId(userId);
  if (!uid) return null;
  const raw = storage.getItem(activeAttendanceStorageKey(uid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalAttendanceSnapshot>;
    if (typeof parsed.id !== "string" || typeof parsed.clockIn !== "string") return null;
    const snapshot: LocalAttendanceSnapshot = {
      id: parsed.id,
      employeeId: parsed.employeeId ?? null,
      userId: parsed.userId ?? uid,
      clockIn: parsed.clockIn,
      clockOut: null,
      hoursWorked: typeof parsed.hoursWorked === "number" ? parsed.hoursWorked : null,
      isClockedIn: true,
      status: typeof parsed.status === "boolean" ? parsed.status : true,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    };
    return Number.isNaN(new Date(snapshot.clockIn).getTime()) ? null : snapshot;
  } catch {
    return null;
  }
}

export function isStaleAttendanceSessionError(message: string): boolean {
  const normalized = message.trim();
  return normalized === "Already clocked out" || normalized === "Attendance not found";
}
export function clearActiveAttendanceSnapshot(
  storage: Pick<Storage, "removeItem">,
  userId: string | null | undefined
): void {
  const uid = normalizeId(userId);
  if (uid) storage.removeItem(activeAttendanceStorageKey(uid));
}