import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "@/handlers/attendance";
import {
  activeAttendanceStorageKey,
  clearActiveAttendanceSnapshot,
  findTodayAttendanceForIdentity,
  getAttendanceStatus,
  isStaleAttendanceSessionError,
  readActiveAttendanceSnapshot,
  saveActiveAttendanceSnapshot,
} from "./attendanceState";

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return { id: "attendance-1", employeeId: null, userId: null, clockIn: "2026-05-15T04:15:00.000Z", clockOut: null, hoursWorked: null, status: true, ...overrides };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("attendance state", () => {
  const now = new Date("2026-05-15T10:00:00.000Z");

  it("finds today's open row by userId using the Nepal calendar day", () => {
    const row = record({ id: "user-row", userId: "user-1" });
    expect(findTodayAttendanceForIdentity([row], { userId: "user-1" }, now)).toEqual(row);
  });

  it("finds today's open row by employeeId fallback", () => {
    const row = record({ id: "employee-row", employeeId: "employee-1" });
    expect(findTodayAttendanceForIdentity([row], { userId: "missing", employeeId: "employee-1" }, now)).toEqual(row);
  });

  it("prefers the latest open row over completed rows", () => {
    const closed = record({ id: "closed", userId: "user-1", clockOut: "2026-05-15T08:00:00.000Z", updatedAt: "2026-05-15T08:00:00.000Z" });
    const open = record({ id: "open", userId: "user-1", clockIn: "2026-05-15T08:30:00.000Z" });
    expect(findTodayAttendanceForIdentity([closed, open], { userId: "user-1" }, now)?.id).toBe("open");
  });

  it("restores an open previous-day session from the same user-specific key", () => {
    const storage = memoryStorage();
    const previousDay = record({ id: "overnight", userId: "user-1", clockIn: "2026-05-14T17:30:00.000Z", isClockedIn: true });
    saveActiveAttendanceSnapshot(storage, "user-1", previousDay);
    expect(readActiveAttendanceSnapshot(storage, "user-1")?.id).toBe("overnight");
    expect(readActiveAttendanceSnapshot(storage, "user-2")).toBeNull();
    expect(storage.data.has(activeAttendanceStorageKey("user-1"))).toBe(true);
  });

  it("removes closed records instead of persisting them as active", () => {
    const storage = memoryStorage();
    saveActiveAttendanceSnapshot(storage, "user-1", record({ userId: "user-1", isClockedIn: true }));
    saveActiveAttendanceSnapshot(storage, "user-1", record({ userId: "user-1", clockOut: "2026-05-15T12:00:00.000Z", isClockedIn: false }));
    expect(readActiveAttendanceSnapshot(storage, "user-1")).toBeNull();
  });

  it("clears stale active-session storage", () => {
    const storage = memoryStorage();
    saveActiveAttendanceSnapshot(storage, "user-1", record({ userId: "user-1", isClockedIn: true }));
    clearActiveAttendanceSnapshot(storage, "user-1");
    expect(readActiveAttendanceSnapshot(storage, "user-1")).toBeNull();
  });

  it("recognizes both backend stale-session responses", () => {
    expect(isStaleAttendanceSessionError("Already clocked out")).toBe(true);
    expect(isStaleAttendanceSessionError("Attendance not found")).toBe(true);
    expect(isStaleAttendanceSessionError("Insufficient stock")).toBe(false);
  });
  it("keeps backend and local clocked-out status semantics", () => {
    expect(getAttendanceStatus(record({ clockOut: "2026-05-15T12:15:00.000Z", hoursWorked: 8 }))).toBe("clocked_out");
    expect(getAttendanceStatus(record({ isClockedIn: true, clockOut: "2026-05-15T12:15:00.000Z" }))).toBe("clocked_in");
  });
});