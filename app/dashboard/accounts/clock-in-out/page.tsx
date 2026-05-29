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
  getTodayAttendanceStatus,
  type AttendanceRecord,
  type ClockInResponse,
  type ClockOutResponse,
} from "@/handlers/attendance";
import {
  findTodayAttendanceForIdentity,
  getAttendanceStatus,
  msUntilNepalAutoClockOut,
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

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return { h, m, s };
}

function formatHoursWorked(h: number | null | undefined): string | null {
  if (h == null || Number.isNaN(h)) return null;
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function idsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === "string" && typeof b === "string" && a.trim() !== "" && a.trim() === b.trim();
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
    isClockedIn: data.isClockedIn ?? true,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function clockOutResponseToSnapshot(
  data: ClockOutResponse["data"],
  currentRecord: AttendanceRecord | LocalAttendanceSnapshot | null | undefined,
  fallbackUserId: string | null,
  fallbackEmployeeId: string | null,
  isFinalClockedOut = false
): LocalAttendanceSnapshot | null {
  if (!data?.id || !data.clockOut) return null;
  return {
    id: data.id,
    employeeId: data.employeeId ?? currentRecord?.employeeId ?? fallbackEmployeeId ?? null,
    userId: data.userId ?? currentRecord?.userId ?? fallbackUserId ?? null,
    clockIn: data.clockIn ?? currentRecord?.clockIn ?? new Date().toISOString(),
    clockOut: data.clockOut,
    hoursWorked: data.hoursWorked,
    isClockedIn: data.isClockedIn ?? false,
    isFinalClockedOut,
    status: data.status ?? currentRecord?.status ?? true,
    createdAt: data.createdAt ?? currentRecord?.createdAt,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
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
  const [autoClockOutAttemptedFor, setAutoClockOutAttemptedFor] = useState<string | null>(null);

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

  /** Clock by authenticated User first; keep Employee.id matching only as a legacy fallback. */
  const storedUser = useMemo(() => getStoredUser(), [authUserId, jwtPermissionNames]);
  const jwtSubjectIds = useMemo(() => getCandidateUserIdsFromToken(), [authUserId, jwtPermissionNames]);

  const clockEmployee = useMemo(
    () => findEmployeeForAttendanceClockAmongCandidates(employees, jwtSubjectIds),
    [employees, jwtSubjectIds]
  );

  const employeeRowId = clockEmployee?.id ?? null;
  const attendanceUserId = firstNonEmpty(storedUser?.id, authUserId, ...jwtSubjectIds);

  const clockPayload = useMemo(
    () => ({
      userId: attendanceUserId ?? undefined,
      employeeId: employeeRowId ?? undefined,
    }),
    [attendanceUserId, employeeRowId]
  );

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

  const { data: todayStatusRecord = null, isLoading: todayStatusLoading } = useQuery({
    queryKey: ["attendanceTodayStatus", attendanceUserId ?? employeeRowId ?? "anonymous"],
    queryFn: async () => {
      const result = await getTodayAttendanceStatus();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        if (result.status === 404) return null;
        throw new Error(result.error);
      }
      return result.data.data ?? null;
    },
    enabled: !!attendanceUserId || !!employeeRowId,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLocalAttendanceRecord(readLocalAttendanceSnapshot(window.localStorage, attendanceUserId));
  }, [attendanceUserId]);

  const todayAttendanceRecord = useMemo(
    () => {
      const localStatus = getAttendanceStatus(localAttendanceRecord);
      const localMatchesIdentity =
        idsMatch(localAttendanceRecord?.userId, attendanceUserId) ||
        idsMatch(localAttendanceRecord?.employeeId, employeeRowId);

      if (localStatus === "final_clocked_out" && localMatchesIdentity) {
        return localAttendanceRecord;
      }

      if (todayStatusRecord) return todayStatusRecord;

      if (
        localStatus === "clocked_out" &&
        localMatchesIdentity
      ) {
        return localAttendanceRecord;
      }
      return (
        findTodayAttendanceForIdentity(attendanceRows, {
          userId: attendanceUserId,
          employeeId: employeeRowId,
        }) ?? localAttendanceRecord
      );
    },
    [attendanceRows, attendanceUserId, employeeRowId, localAttendanceRecord, todayStatusRecord]
  );

  const persistedStatus = getAttendanceStatus(todayAttendanceRecord);
  const isClockedIn = persistedStatus === "clocked_in";
  const isFinalClockedOut = persistedStatus === "final_clocked_out";

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

  const clockInMutation = useMutation({
    mutationFn: () => clockInApi(clockPayload),
    onSuccess: async (result) => {
      if (result.ok) {
        const snapshot = clockInResponseToSnapshot(result.data.data, attendanceUserId, employeeRowId);
        if (snapshot && typeof window !== "undefined") {
          saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
          setLocalAttendanceRecord(snapshot);
        }
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ["attendanceTodayStatus"] });
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
    mutationFn: (intent: "pause" | "final") =>
      clockOutApi(clockPayload).then((result) => ({ result, intent })),
    onSuccess: async ({ result, intent }) => {
      if (result.ok) {
        const clockOutUserMatches =
          (!result.data.data?.userId && !result.data.data?.employeeId) ||
          idsMatch(result.data.data?.userId, attendanceUserId) ||
          idsMatch(result.data.data?.employeeId, employeeRowId);
        const snapshot = clockOutResponseToSnapshot(
          result.data.data,
          todayAttendanceRecord,
          attendanceUserId,
          employeeRowId,
          intent === "final"
        );
        if (snapshot && clockOutUserMatches && typeof window !== "undefined") {
          saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
          setLocalAttendanceRecord(snapshot);
        }
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ["attendanceTodayStatus"] });
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
              isClockedIn: false,
              isFinalClockedOut: intent === "final",
              status: todayAttendanceRecord.status,
              createdAt: todayAttendanceRecord.createdAt,
              updatedAt: new Date().toISOString(),
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

  useEffect(() => {
    if (!todayAttendanceRecord?.id || isFinalClockedOut || (!attendanceUserId && !employeeRowId)) return;

    const msUntilAutoClockOut = msUntilNepalAutoClockOut();
    const autoKey = `${todayAttendanceRecord.id}:${todayAttendanceRecord.clockIn}`;

    if (persistedStatus === "clocked_out" && msUntilAutoClockOut <= 0) {
      const snapshot: LocalAttendanceSnapshot = {
        id: todayAttendanceRecord.id,
        employeeId: todayAttendanceRecord.employeeId ?? employeeRowId ?? null,
        userId: todayAttendanceRecord.userId ?? attendanceUserId ?? null,
        clockIn: todayAttendanceRecord.clockIn,
        clockOut: todayAttendanceRecord.clockOut ?? new Date().toISOString(),
        hoursWorked: todayAttendanceRecord.hoursWorked ?? null,
        isClockedIn: false,
        isFinalClockedOut: true,
        status: todayAttendanceRecord.status,
        createdAt: todayAttendanceRecord.createdAt,
        updatedAt: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        saveLocalAttendanceSnapshot(window.localStorage, attendanceUserId, snapshot);
      }
      setLocalAttendanceRecord(snapshot);
      return;
    }

    if (persistedStatus !== "clocked_in" || autoClockOutAttemptedFor === autoKey) return;

    const autoClockOut = () => {
      setAutoClockOutAttemptedFor(autoKey);
      clockOutMutation.mutate("final");
    };

    if (msUntilAutoClockOut <= 0) {
      autoClockOut();
      return;
    }

    const timeout = window.setTimeout(autoClockOut, msUntilAutoClockOut);
    return () => window.clearTimeout(timeout);
  }, [
    attendanceUserId,
    autoClockOutAttemptedFor,
    clockOutMutation,
    employeeRowId,
    isFinalClockedOut,
    persistedStatus,
    todayAttendanceRecord,
  ]);

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

  const handlePause = () => {
    if (!attendanceUserId && !employeeRowId) return;
    setClockError(null);
    clockOutMutation.mutate("pause");
  };

  const handleClockOut = () => {
    if (!attendanceUserId && !employeeRowId) return;
    setClockError(null);
    clockOutMutation.mutate("final");
  };

  const { h, m, s } = formatElapsed(elapsedSeconds);
  const loading = clockInMutation.isPending || clockOutMutation.isPending;
  const resolvingAttendance = (todayStatusLoading || attendancesLoading) && !localAttendanceRecord;
  const buttonStatus: AttendanceStatus = resolvingAttendance ? "loading" : persistedStatus;
  const hasTodayAttendance = !!todayAttendanceRecord?.clockIn;
  const todayHoursWorkedLabel = formatHoursWorked(todayAttendanceRecord?.hoursWorked);
  const showTodayHoursWorked = hasTodayAttendance && todayHoursWorkedLabel != null;

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
          {showTodayHoursWorked ? (
            <div className="clockInOutDailyTotal" role="status">
              <span className="clockInOutDailyTotalLabel">{t("Today's total hours")}</span>
              <span className="clockInOutDailyTotalValue">{todayHoursWorkedLabel}</span>
              {isClockedIn ? (
                <span className="clockInOutDailyTotalSub">
                  {t("Timer above shows the current session only.")}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="clockInOutHint">
            {buttonStatus === "final_clocked_out"
              ? t("You are clocked out for today.")
              : buttonStatus === "clocked_out"
              ? t("Your attendance is paused. Resume when you start working again.")
              : isClockedIn
                ? t("You are clocked in. Pause for breaks or clock out to finish today.")
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
            <div className="clockInOutActions">
              <button
                type="button"
                className="clockInOutBtn clockInOutBtnYellow"
                onClick={handlePause}
                disabled={loading || (!attendanceUserId && !employeeRowId)}
              >
                {loading ? t("Processing…") : t("Pause")}
              </button>
              <button
                type="button"
                className="clockInOutBtn clockInOutBtnRed"
                onClick={handleClockOut}
                disabled={loading || (!attendanceUserId && !employeeRowId)}
              >
                {loading ? t("Processing…") : t("Clock Out")}
              </button>
            </div>
          ) : buttonStatus === "clocked_out" ? (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnYellow"
              onClick={handleClockIn}
              disabled={loading || (!attendanceUserId && !employeeRowId)}
            >
              {loading ? t("Processing…") : t("Resume")}
            </button>
          ) : isFinalClockedOut ? (
            <button type="button" className="clockInOutBtn clockInOutBtnRed" disabled>
              {t("Clocked Out")}
            </button>
          ) : (
            <button
              type="button"
              className={`clockInOutBtn ${hasTodayAttendance ? "clockInOutBtnYellow" : "clockInOutBtnGreen"}`}
              onClick={handleClockIn}
              disabled={loading || (!attendanceUserId && !employeeRowId)}
            >
              {loading || buttonStatus === "loading" ? t("Processing…") : t(hasTodayAttendance ? "Resume" : "Clock In")}
            </button>
          )}
        </div>

        {/* <div className="clockInOutStats">
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
        </div> */}
      </div>
    </section>
  );
}
