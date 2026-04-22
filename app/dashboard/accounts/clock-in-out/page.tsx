"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import { useOutletScope } from "@/app/providers/OutletScopeProvider";
import { getEmployees } from "@/handlers/employee";
import {
  clockIn as clockInApi,
  clockOut as clockOutApi,
  getAttendances,
  type AttendanceRecord,
} from "@/handlers/attendance";
import "./clock-in-out.scss";

const EMPLOYEES_QUERY_KEY = ["employees"];
const ATTENDANCES_QUERY_KEY = ["attendances"];

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameLocalCalendarDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();
}

function isClockInToday(clockInIso: string): boolean {
  return isSameLocalCalendarDay(new Date(clockInIso), new Date());
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

function findOpenAttendanceToday(
  rows: AttendanceRecord[],
  employeeId: string
): AttendanceRecord | undefined {
  return rows.find(
    (r) =>
      r.employeeId === employeeId &&
      r.clockIn &&
      isClockInToday(r.clockIn) &&
      (r.clockOut == null || r.clockOut === "")
  );
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

export default function ClockInOutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isScoped, scopedOutletId } = useOutletScope();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockError, setClockError] = useState<string | null>(null);

  const { data: employeesRaw = [] } = useQuery({
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

  const employees = useMemo(() => {
    if (!isScoped || !scopedOutletId) return employeesRaw;
    return employeesRaw.filter((e) => e.outletId === scopedOutletId);
  }, [employeesRaw, isScoped, scopedOutletId]);

  const { data: attendanceRows = [], isLoading: attendancesLoading } = useQuery({
    queryKey: ATTENDANCES_QUERY_KEY,
    queryFn: async () => {
      const result = await getAttendances();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      const list = result.data.data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const openRecord = useMemo(() => {
    if (!selectedEmployeeId) return undefined;
    return findOpenAttendanceToday(attendanceRows, selectedEmployeeId);
  }, [attendanceRows, selectedEmployeeId]);

  const isClockedIn = !!openRecord;

  useEffect(() => {
    if (!openRecord?.clockIn) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      const start = new Date(openRecord.clockIn).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [openRecord?.clockIn]);

  const stats = useMemo(() => {
    const todayRows = attendanceRows.filter((r) => r.clockIn && isClockInToday(r.clockIn));
    const presentIds = new Set(todayRows.map((r) => r.employeeId));
    const totalStaff = employees.length;
    const presentToday = presentIds.size;
    const absentToday = totalStaff > 0 ? Math.max(0, totalStaff - presentToday) : 0;
    const pct =
      totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;
    const weeklyHours = attendanceRows.reduce((sum, r) => {
      if (
        r.clockIn &&
        isInCurrentWeek(r.clockIn) &&
        r.hoursWorked != null &&
        typeof r.hoursWorked === "number"
      ) {
        return sum + r.hoursWorked;
      }
      return sum;
    }, 0);
    return {
      totalStaff,
      presentToday,
      absentToday,
      pctPresent: pct,
      weeklyWorkLabel: formatWeeklyHours(weeklyHours),
    };
  }, [attendanceRows, employees.length]);

  const clockInMutation = useMutation({
    mutationFn: (employeeId: string) => clockInApi(employeeId),
    onSuccess: async (result) => {
      if (result.ok) {
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ATTENDANCES_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  const clockOutMutation = useMutation({
    mutationFn: (employeeId: string) => clockOutApi(employeeId),
    onSuccess: async (result) => {
      if (result.ok) {
        setClockError(null);
        await queryClient.invalidateQueries({ queryKey: ATTENDANCES_QUERY_KEY });
      } else {
        if (result.status === 401) navigate("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  const handleClockIn = () => {
    if (!selectedEmployeeId) {
      setClockError(t("Please select an employee."));
      return;
    }
    setClockError(null);
    clockInMutation.mutate(selectedEmployeeId);
  };

  const handleClockOut = () => {
    if (!selectedEmployeeId) return;
    setClockError(null);
    clockOutMutation.mutate(selectedEmployeeId);
  };

  const { h, m, s } = formatElapsed(elapsedSeconds);
  const loading = clockInMutation.isPending || clockOutMutation.isPending;

  const statPresentSub =
    stats.totalStaff > 0 ? `${stats.pctPresent}% ${t("Present")}` : "";

  return (
    <section className="clockInOutPage">
      <div className="breadcrumb">
        <span>{t("Attendance")}</span> {"›"} {t("Clock-IN/OUT")}
      </div>

      <div className="clockInOutHeader">
        <div className="clockInOutHeaderText">
          <h1 className="pageTitle">{t("Clock-IN/OUT")}</h1>
          <p className="pageSubtitle">
            {t("Track staff attendance and working hours")}
          </p>
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
            {isClockedIn
              ? t("You are clocked in. Click Clock-OUT when you finish.")
              : t("Start tracking your time by clocking in.")}
          </p>
          {employees.length > 0 && (
            <div className="clockInOutSelectWrap">
              <select
                className="clockInOutSelect"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                aria-label={t("Select employee")}
                disabled={isClockedIn}
              >
                <option value="">{t("Select employee")}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}
          {clockError && (
            <p className="clockInOutError" role="alert">
              {clockError}
            </p>
          )}
          {isClockedIn ? (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnPrimary"
              onClick={handleClockOut}
              disabled={loading}
            >
              {loading ? t("Processing…") : t("Clock-OUT")}
            </button>
          ) : (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnPrimary"
              onClick={handleClockIn}
              disabled={loading || !selectedEmployeeId}
            >
              {loading ? t("Processing…") : t("Clock-IN")}
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
              {stats.totalStaff > 0
                ? `${t("Total Staff")}: ${stats.totalStaff}`
                : ""}
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
