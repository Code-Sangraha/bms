import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "@/handlers/attendance";
import {
  findTodayAttendanceForIdentity,
  getAttendanceStatus,
  localAttendanceStorageKey,
  msUntilNepalAutoClockOut,
  nepalAutoClockOutDeadline,
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

  it("calculates the automatic clock-out deadline at 11 PM Nepal time", () => {
    const beforeDeadline = new Date("2026-05-15T16:00:00.000Z");
    const afterDeadline = new Date("2026-05-15T18:00:00.000Z");

    expect(nepalAutoClockOutDeadline(beforeDeadline).toISOString()).toBe("2026-05-15T17:15:00.000Z");
    expect(msUntilNepalAutoClockOut(beforeDeadline)).toBe(75 * 60 * 1000);
    expect(msUntilNepalAutoClockOut(afterDeadline)).toBeLessThan(0);
  });

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

  it("uses isClockedIn when the backend provides pause/resume state", () => {
    expect(getAttendanceStatus(record({ isClockedIn: true, clockOut: "2026-05-15T12:15:00.000Z" }))).toBe(
      "clocked_in"
    );
    expect(getAttendanceStatus(record({ isClockedIn: false, clockOut: null }))).toBe("clocked_out");
  });

  it("treats locally finalized rows as final_clocked_out", () => {
    expect(getAttendanceStatus({ ...record({ isClockedIn: false }), isFinalClockedOut: true })).toBe(
      "final_clocked_out"
    );
  });

  it("prefers the latest open row when duplicate same-day user rows exist", () => {
    const oldestOpen = record({
      id: "open-1",
      userId: "user-1",
      clockIn: "2026-05-15T11:15:10.598Z",
    });
    const completedLaterThanOldest = record({
      id: "closed-1",
      userId: "user-1",
      clockIn: "2026-05-15T11:22:25.869Z",
      clockOut: "2026-05-15T11:48:02.590Z",
      updatedAt: "2026-05-15T11:48:02.594Z",
    });
    const latestOpen = record({
      id: "open-2",
      userId: "user-1",
      clockIn: "2026-05-15T11:47:52.263Z",
    });

    expect(
      findTodayAttendanceForIdentity(
        [oldestOpen, completedLaterThanOldest, latestOpen],
        { userId: "user-1" },
        new Date("2026-05-15T12:04:52.646Z")
      )?.id
    ).toBe("open-2");
  });

  it("prefers an isClockedIn row over paused same-day rows", () => {
    const pausedLater = record({
      id: "paused",
      userId: "user-1",
      isClockedIn: false,
      clockIn: "2026-05-15T11:47:52.263Z",
      clockOut: null,
      updatedAt: "2026-05-15T11:50:16.161Z",
    });
    const activeEarlier = record({
      id: "active",
      userId: "user-1",
      isClockedIn: true,
      clockIn: "2026-05-15T11:15:10.598Z",
      clockOut: "2026-05-15T11:20:00.000Z",
      updatedAt: "2026-05-15T11:20:00.000Z",
    });

    expect(findTodayAttendanceForIdentity([pausedLater, activeEarlier], { userId: "user-1" }, now)?.id).toBe(
      "active"
    );
  });

  it("uses the latest completed row when no open row remains", () => {
    const firstClosed = record({
      id: "closed-1",
      userId: "user-1",
      clockIn: "2026-05-15T11:15:10.598Z",
      clockOut: "2026-05-15T11:47:57.031Z",
      updatedAt: "2026-05-15T11:47:57.034Z",
    });
    const latestClosed = record({
      id: "closed-2",
      userId: "user-1",
      clockIn: "2026-05-15T11:47:52.263Z",
      clockOut: "2026-05-15T11:50:16.158Z",
      updatedAt: "2026-05-15T11:50:16.161Z",
    });

    expect(
      findTodayAttendanceForIdentity([firstClosed, latestClosed], { userId: "user-1" }, now)?.id
    ).toBe("closed-2");
  });

  it("restores local fallback only for the same user and date", () => {
    const storage = memoryStorage();
    const row = record({ id: "local-row", userId: "user-1" });

    saveLocalAttendanceSnapshot(storage, "user-1", row, now);

    expect(readLocalAttendanceSnapshot(storage, "user-1", now)?.id).toBe("local-row");
    expect(readLocalAttendanceSnapshot(storage, "user-1", now)?.isClockedIn).toBeUndefined();
    expect(readLocalAttendanceSnapshot(storage, "user-2", now)).toBeNull();
    expect(readLocalAttendanceSnapshot(storage, "user-1", new Date("2026-05-16T10:00:00.000Z"))).toBeNull();
    expect(storage.data.has(localAttendanceStorageKey("user-1", now))).toBe(true);
  });

  it("restores local final clock-out state for the same day", () => {
    const storage = memoryStorage();
    const row = { ...record({ id: "final-row", userId: "user-1", isClockedIn: false }), isFinalClockedOut: true };

    saveLocalAttendanceSnapshot(storage, "user-1", row, now);

    expect(readLocalAttendanceSnapshot(storage, "user-1", now)?.isFinalClockedOut).toBe(true);
    expect(getAttendanceStatus(readLocalAttendanceSnapshot(storage, "user-1", now))).toBe("final_clocked_out");
  });
});
