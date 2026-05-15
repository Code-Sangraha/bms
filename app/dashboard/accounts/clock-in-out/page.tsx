"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { getRowScopeIdFromUrlOrHighlandSearch } from "@/lib/outletScope";
import { getCandidateUserIdsFromToken } from "@/lib/auth/role";
import { getStoredUser } from "@/lib/auth/user";
import { getEmployees } from "@/handlers/employee";
import { findEmployeeForAttendanceClockAmongCandidates } from "@/handlers/employeeMatch";
import {
  clockIn as clockInApi,
  clockOut as clockOutApi,
  getAttendances,
  type AttendanceRecord,
  type ClockInResponse,
  type ClockOutResponse,
} from "@/handlers/attendance";
import {
  findTodayAttendanceForIdentity,
  getAttendanceStatus,
  isClockInToday,
  readLocalAttendanceSnapshot,
  saveLocalAttendanceSnapshot,
  type AttendanceStatus,
  type LocalAttendanceSnapshot,
} from "./attendanceState";
import "./clock-in-out.scss";

const EMPLOYEES_QUERY_KEY = ["employees"];

function attendanceQueryKey(base: string | null) {
  return ["attendances", base ?? "all"] as const;
}

function startOfWeekMonday(ref: Date): Date {
  const x = new Date(ref);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekMonday(ref: Date): Date {
  const start = startOfWeekMonday(ref);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return end;
}

function isInCurrentWeek(clockInIso: string): boolean {
  const t = new Date(clockInIso).getTime();
  const now = new Date();
  return t >= startOfWeekMonday(now).getTime() && t <= endOfWeekMonday(now).getTime();
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return { h, m, s };
}

function formatWeeklyHours(totalDecimal: number): string {
  if (!Number.isFinite(totalDecimal) || totalDecimal <= 0) return "0h 0m";
  const totalMinutes = Math.round(totalDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function isAlreadyClockedMessage(message: string, target: "in" | "out"): boolean {
  const m = message.toLowerCase();
  if (target === "in") return m.includes("already") && (m.includes("clocked-in") || m.includes("clocked in"));
  return m.includes("already") && (m.includes("clocked-out") || m.includes("clocked out"));
}

function clockInResponseToSnapshot(
  data: ClockInResponse["data"],
  fallbackUserId: string | null,
  fallbackEmployeeId: string | null
): LocalAttendanceSnapshot | null {
  if (!data?.id || !data.clockIn) return null;
  return {
    id: data.id,
    employeeId: data.employeeId ?? fallbackEmployeeId ?? null,
    userId: data.userId ?? fallbackUserId ?? null,
    clockIn: data.clockIn,
    clockOut: data.clockOut ?? null,
    hoursWorked: data.hoursWorked ?? null,
    status: data.status,
  };
}

function clockOutResponseToSnapshot(
  data: ClockOutResponse["data"],
  currentRecord: AttendanceRecord | LocalAttendanceSnapshot | null | undefined,
  fallbackUserId: string | null,
  fallbackEmployeeId: string | null
): LocalAttendanceSnapshot | null {
  if (!data?.id || !data.clockOut) return null;
  return {
    id: data.id,
    employeeId: data.employeeId ?? currentRecord?.employeeId ?? fallbackEmployeeId ?? null,
    userId: data.userId ?? currentRecord?.userId ?? fallbackUserId ?? null,
    clockIn: data.clockIn ?? currentRecord?.clockIn ?? new Date().toISOString(),
    clockOut: data.clockOut,
    hoursWorked: data.hoursWorked,
    status: data.status ?? currentRecord?.status ?? true,
  };
}

export default function ClockInOutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search } = useLocation();
  const { t } = useI18n();
  const { userOutletId, authUserId, jwtPermissionNames, roleName } = useAuth();
  const { rowFilterOutletId } = useRowFilterOutletId();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockError, setClockError] = useState<string | null>(null);
  const [localAttendanceRecord, setLocalAttendanceRecord] = useState<LocalAttendanceSnapshot | null>(null);

  const attendanceOutletId = useMemo(() => {
    const fromHighlandUrl = getRowScopeIdFromUrlOrHighlandSearch(search);
    return rowFilterOutletId ?? fromHighlandUrl ?? userOutletId ?? null;
  }, [search, rowFilterOutletId, userOutletId]);

  const attendancesKey = attendanceQueryKey(attendanceOutletId);

  const { data: employees = [] } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: async () => {
      const result = await getEmployees();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const employeesInScope = useMemo(() => {
    if (!attendanceOutletId) return employees;
    return employees.filter((e) => e.outletId === attendanceOutletId);
  }, [employees, attendanceOutletId]);

  /** Clock by authenticated User first; keep Employee.id matching only as a legacy fallback. */
  const storedUser = useMemo(() => getStoredUser(), [authUserId, jwtPermissionNames]);
  const jwtSubjectIds = useMemo(() => getCandidateUserIdsFromToken(), [authUserId, jwtPermissionNames]);

  const clockEmployee = useMemo(
    () => findEmployeeForAttendanceClockAmongCandidates(employees, jwtSubjectIds),
    [employees, jwtSubjectIds]
  );

  const employeeRowId = clockEmployee?.id ?? null;
  const attendanceUserId = firstNonEmpty(storedUser?.id, authUserId, ...jwtSubjectIds);

  const clockEmployeeOutsideSelectedOutlet =
    !!clockEmployee &&
    !!attendanceOutletId &&
    clockEmployee.outletId !== attendanceOutletId;

  const clockIdentityDisplay = firstNonEmpty(
    storedUser?.fullName,
    storedUser?.email,
    clockEmployee ? `${clockEmployee.name} (${clockEmployee.employeeId})` : null,
    storedUser?.roleName,
    roleName
  );

  const { data: attendanceRows = [], isLoading: attendancesLoading } = useQuery({
    queryKey: attendancesKey,
    queryFn: async () => {
      const result = await getAttendances(attendanceOutletId);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      const list = result.data.data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLocalAttendanceRecord(readLocalAttendanceSnapshot(window.localStorage, attendanceUserId));
  }, [attendanceUserId]);

  const todayAttendanceRecord = useMemo(
    () =>
      findTodayAttendanceForIdentity(attendanceRows, {
        userId: attendanceUserId,
        employeeId: employeeRowId,
      }) ?? localAttendanceRecord,
    [attendanceRows, attendanceUserId, employeeRowId, localAttendanceRecord]
  );

  const persistedStatus = getAttendanceStatus(todayAttendanceRecord);
  const isClockedIn = persistedStatus === "clocked_in";

  useEffect(() => {
    if (!todayAttendanceRecord?.clockIn || persistedStatus !== "clocked_in") {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      const start = new Date(todayAttendanceRecord.clockIn).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [persistedStatus, todayAttendanceRecord?.clockIn]);

  const stats = useMemo(() => {
    const roster = attendanceOutletId ? employeesInScope : employees;
    const rosterIds = new Set(roster.map((e) => e.id));
    const outletScoped = attendanceOutletId != null;

    const todayRowsAll = attendanceRows.filter(
      (r) =>
        r.clockIn &&
        isClockInToday(r.clockIn) &&
        typeof r.employeeId === "string" &&
        r.employeeId.trim() !== ""
    );

    const todayRowsForStats = !outletScoped
      ? todayRowsAll
      : rosterIds.size > 0
        ? todayRowsAll.filter((r) => rosterIds.has(r.employeeId as string))
        : [];

    const presentIds = new Set(todayRowsForStats.map((r) => r.employeeId as string));
    const totalStaff = roster.length;
    const presentToday = (() => {
      if (!outletScoped) return presentIds.size;
      if (rosterIds.size === 0) return 0;
      return [...rosterIds].filter((id) => presentIds.has(id)).length;
    })();
    const absentToday = totalStaff > 0 ? Math.max(0, totalStaff - presentToday) : 0;
    const pct = totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;

    const weeklyHours = attendanceRows.reduce((sum, r) => {
      if (
        !r.clockIn ||
        !isInCurrentWeek(r.clockIn) ||
        r.hoursWorked == null ||
        typeof r.hoursWorked !== "number"
      ) {
        return sum;
      }
      const eid = r.employeeId;
      if (outletScoped) {
        if (rosterIds.size === 0) return sum;
        if (typeof eid !== "string" || eid.trim() === "" || !rosterIds.has(eid)) return sum;
      }
      return sum + r.hoursWorked;
    }, 0);

    return {
      totalStaff,
      presentToday,
      absentToday,
      pctPresent: pct,
      weeklyWorkLabel: formatWeeklyHours(weeklyHours),
    };
  }, [attendanceRows, attendanceOutletId, employees, employeesInScope]);

  const clockInMutation = useMutation({
    mutationFn: () => clockInApi(),
    onSuccess: async (result) => {
      if (result.ok) {
        const snapshot = clockInResponseToSnapshot(result.data.data, attendanceUserId, employeeRowId);
        if (snapshot && typeof window !== "undefined") {
          saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
          setLocalAttendanceRecord(snapshot);
        }
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ["attendances"] });
      } else {
        if (result.status === 401) navigate("/login");
        else {
          if (isAlreadyClockedMessage(result.error, "in") && todayAttendanceRecord) {
            setLocalAttendanceRecord(todayAttendanceRecord);
          }
          setClockError(result.error);
        }
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => clockOutApi(),
    onSuccess: async (result) => {
      if (result.ok) {
        const snapshot = clockOutResponseToSnapshot(
          result.data.data,
          todayAttendanceRecord,
          attendanceUserId,
          employeeRowId
        );
        if (snapshot && typeof window !== "undefined") {
          saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
          setLocalAttendanceRecord(snapshot);
        }
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ["attendances"] });
      } else {
        if (result.status === 401) navigate("/login");
        else {
          const alreadyClockedOut = isAlreadyClockedMessage(result.error, "out");
          if (alreadyClockedOut && todayAttendanceRecord) {
            const snapshot: LocalAttendanceSnapshot = {
              id: todayAttendanceRecord.id,
              employeeId: todayAttendanceRecord.employeeId ?? employeeRowId ?? null,
              userId: todayAttendanceRecord.userId ?? attendanceUserId ?? null,
              clockIn: todayAttendanceRecord.clockIn,
              clockOut: todayAttendanceRecord.clockOut ?? new Date().toISOString(),
              hoursWorked: todayAttendanceRecord.hoursWorked ?? null,
              status: todayAttendanceRecord.status,
            };
            if (typeof window !== "undefined") {
              saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
            }
            setLocalAttendanceRecord(snapshot);
          }
          setClockError(
            alreadyClockedOut
              ? result.error
              : `${result.error} ${t(
                  "Clock-out could not be completed by the server. Please ask an admin to verify today's attendance if this keeps happening."
                )}`
          );
        }
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  const handleClockIn = () => {
    if (!attendanceUserId && !employeeRowId) {
      setClockError(
        t(
          "Could not read your user id from the access token. Sign in again, or ask an admin to include userId or sub in the token payload."
        )
      );
      return;
    }
    setClockError(null);
    clockInMutation.mutate();
  };

  const handleClockOut = () => {
    if (!attendanceUserId && !employeeRowId) return;
    setClockError(null);
    clockOutMutation.mutate();
  };

  const { h, m, s } = formatElapsed(elapsedSeconds);
  const loading = clockInMutation.isPending || clockOutMutation.isPending;
  const buttonStatus: AttendanceStatus = loading ? "loading" : persistedStatus;

  const statPresentSub = stats.totalStaff > 0 ? `${stats.pctPresent}% ${t("Present")}` : "";

  return (
    <section className="clockInOutPage">
      <div className="breadcrumb">
        <span>{t("Attendance")}</span> {"›"} {t("Clock-IN/OUT")}
      </div>

      <div className="clockInOutHeader">
        <div className="clockInOutHeaderText">
          <h1 className="pageTitle">{t("Clock-IN/OUT")}</h1>
          <p className="pageSubtitle">{t("Track staff attendance and working hours")}</p>
        </div>
      </div>

      <div className="clockInOutLayout">
        <div className="clockInOutCard">
          <span className="clockInOutLabel">{t("Clock in")}</span>
          <div className="clockInOutTimer">
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(h).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">{t("HOURS")}</span>
            </div>
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(m).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">{t("MINUTES")}</span>
            </div>
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(s).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">{t("SECONDS")}</span>
            </div>
          </div>
          <p className="clockInOutHint">
            {buttonStatus === "clocked_out"
              ? t("You are clocked out for today.")
              : isClockedIn
                ? t("You are clocked in. Click Clock-OUT when you finish.")
                : t("Start tracking your time by clocking in.")}
          </p>

          {clockIdentityDisplay ? (
            <>
              <p className="clockInOutHint" role="status">
                <strong>{t("Clocking in as")}:</strong> {clockIdentityDisplay}
              </p>
              {clockEmployeeOutsideSelectedOutlet ? (
                <p className="clockInOutHint" role="status">
                  {t(
                    "Your employee record belongs to another outlet than the one selected here. You can still clock in/out; present/absent counts below use the selected outlet roster."
                  )}
                </p>
              ) : null}
            </>
          ) : !attendanceUserId && !employeeRowId ? (
            <p className="clockInOutHint" role="status">
              {t(
                "Could not read your user id from the access token. Sign in again, or ask an admin to include userId or sub in the token payload."
              )}
            </p>
          ) : null}

          {clockError && (
            <p className="clockInOutError" role="alert">
              {clockError}
            </p>
          )}
          {buttonStatus === "clocked_in" ? (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnPrimary"
              onClick={handleClockOut}
              disabled={loading || (!attendanceUserId && !employeeRowId)}
            >
              {buttonStatus === "loading" ? t("Processing…") : t("Clock Out")}
            </button>
          ) : buttonStatus === "clocked_out" ? (
            <button type="button" className="clockInOutBtn clockInOutBtnPrimary" disabled>
              {t("Clocked Out")}
            </button>
          ) : (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnPrimary"
              onClick={handleClockIn}
              disabled={loading || (!attendanceUserId && !employeeRowId)}
            >
              {buttonStatus === "loading" ? t("Processing…") : t("Clock In")}
            </button>
          )}
        </div>

        <div className="clockInOutStats">
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Weekly Work")}</span>
            <span className="clockInOutStatValue">
              {attendancesLoading ? "—" : stats.weeklyWorkLabel}
            </span>
            <span className="clockInOutStatSub">{t("This week")}</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Present Today")}</span>
            <span className="clockInOutStatValue">
              {attendancesLoading ? "—" : String(stats.presentToday)}
            </span>
            <span className="clockInOutStatSub">{statPresentSub}</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Absent Today")}</span>
            <span className="clockInOutStatValue">
              {attendancesLoading ? "—" : String(stats.absentToday)}
            </span>
            <span className="clockInOutStatSub">
              {stats.totalStaff > 0 ? `${t("Total Staff")}: ${stats.totalStaff}` : ""}
            </span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Total Staff")}</span>
            <span className="clockInOutStatValue">{String(stats.totalStaff)}</span>
            <span className="clockInOutStatSub">{t("Total Staff")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
