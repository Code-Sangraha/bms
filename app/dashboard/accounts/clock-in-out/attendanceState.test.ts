import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "@/handlers/attendance";
import {
  findTodayAttendanceForIdentity,
  getAttendanceStatus,
  localAttendanceStorageKey,
  readLocalAttendanceSnapshot,
  saveLocalAttendanceSnapshot,
} from "./attendanceState";

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: "attendance-1",
    employeeId: null,
    userId: null,
    clockIn: "2026-05-15T04:15:00.000Z",
    clockOut: null,
    hoursWorked: null,
    status: true,
    ...overrides,
  };
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("attendance state", () => {
  const now = new Date("2026-05-15T10:00:00.000Z");

  it("finds today's open row by userId", () => {
    const row = record({ id: "user-row", userId: "user-1" });

    expect(
      findTodayAttendanceForIdentity([row], { userId: "user-1", employeeId: null }, now)
    ).toEqual(row);
  });

  it("finds today's open row by employeeId fallback", () => {
    const row = record({ id: "employee-row", employeeId: "employee-1" });

    expect(
      findTodayAttendanceForIdentity([row], { userId: "missing", employeeId: "employee-1" }, now)
    ).toEqual(row);
  });

  it("ignores yesterday's rows", () => {
    const row = record({
      userId: "user-1",
      clockIn: "2026-05-14T04:15:00.000Z",
    });

    expect(findTodayAttendanceForIdentity([row], { userId: "user-1" }, now)).toBeUndefined();
  });

  it("treats rows with clockOut as clocked_out", () => {
    const row = record({ clockOut: "2026-05-15T12:15:00.000Z", hoursWorked: 8 });

    expect(getAttendanceStatus(row)).toBe("clocked_out");
  });

  it("restores local fallback only for the same user and date", () => {
    const storage = memoryStorage();
    const row = record({ id: "local-row", userId: "user-1" });

    saveLocalAttendanceSnapshot(storage, "user-1", row, now);

    expect(readLocalAttendanceSnapshot(storage, "user-1", now)?.id).toBe("local-row");
    expect(readLocalAttendanceSnapshot(storage, "user-2", now)).toBeNull();
    expect(readLocalAttendanceSnapshot(storage, "user-1", new Date("2026-05-16T10:00:00.000Z"))).toBeNull();
    expect(storage.data.has(localAttendanceStorageKey("user-1", now))).toBe(true);
  });
});

