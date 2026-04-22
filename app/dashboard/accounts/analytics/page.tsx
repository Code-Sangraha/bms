"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { getAttendances, type AttendanceRecord } from "@/handlers/attendance";
import { getEmployees } from "@/handlers/employee";
import { getOutlets } from "@/handlers/outlet";
import "./analytics.scss";

const ATTENDANCES_QUERY_KEY = ["attendances"];
const EMPLOYEES_QUERY_KEY = ["employees"];
const OUTLETS_QUERY_KEY = ["outlets"];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return "—";
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

function isClockInToday(clockInIso: string): boolean {
  const d = new Date(clockInIso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function rowOutletId(row: AttendanceRecord): string | undefined {
  return row.employee?.outletId ?? row.user?.outletId;
}

export default function AccountsAnalyticsPage() {
  const navigate = useNavigate();
  const { isScoped, rowFilterOutletId, scopeLabel } = useRowFilterOutletId();
  const [outletFilter, setOutletFilter] = useState("all");
  const { t } = useI18n();

  useEffect(() => {
    if (isScoped && rowFilterOutletId) setOutletFilter(rowFilterOutletId);
    else if (!isScoped) setOutletFilter("all");
  }, [isScoped, rowFilterOutletId]);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
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

  const { data: outlets = [], isLoading: outletsLoading } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: attendanceRows = [],
    isLoading: attendancesLoading,
    isFetching: attendancesFetching,
    dataUpdatedAt,
  } = useQuery({
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

  const filteredRows = useMemo(() => {
    if (outletFilter === "all") return attendanceRows;
    return attendanceRows.filter((r) => rowOutletId(r) === outletFilter);
  }, [attendanceRows, outletFilter]);

  const employeesInScope = useMemo(() => {
    if (!isScoped || !rowFilterOutletId) return employees;
    return employees.filter((e) => e.outletId === rowFilterOutletId);
  }, [employees, isScoped, rowFilterOutletId]);

  const presentTodayCount = useMemo(() => {
    const todayRows = attendanceRows.filter((r) => r.clockIn && isClockInToday(r.clockIn));
    const scopeIds = new Set(employeesInScope.map((e) => e.id));
    return new Set(
      todayRows.filter((r) => scopeIds.has(r.employeeId)).map((r) => r.employeeId)
    ).size;
  }, [attendanceRows, employeesInScope]);

  const totalStaff = employeesInScope.length;
  const pctPresent =
    totalStaff > 0 ? Math.round((presentTodayCount / totalStaff) * 100) : 0;

  const lastUpdatedLabel =
    attendancesFetching && !dataUpdatedAt
      ? t("Loading…")
      : dataUpdatedAt
        ? new Date(dataUpdatedAt).toLocaleTimeString()
        : "";

  return (
    <section className="analyticsPage">
      <div className="breadcrumb">
        <span>{t("Attendance")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Analytics")}</span>
      </div>

      <div className="analyticsHeader">
        <div className="analyticsHeaderText">
          <h1 className="pageTitle">{t("Analytics")}</h1>
          <p className="pageSubtitle">{t("Track staff attendance and working hours.")}</p>
        </div>
        <div className="analyticsToolbar">
          {isScoped && rowFilterOutletId ? (
            <span className="analyticsOutletSelect analyticsOutletReadonly" aria-live="polite">
              {scopeLabel || outlets.find((o) => o.id === rowFilterOutletId)?.name || rowFilterOutletId}
            </span>
          ) : (
            <select
              className="analyticsOutletSelect"
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              aria-label={t("Filter by outlet")}
              disabled={outletsLoading}
            >
              <option value="all">{t("All Outlets")}</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <span className="analyticsLastSync">
            {lastUpdatedLabel ? `${t("Last updated")}: ${lastUpdatedLabel}` : ""}
          </span>
        </div>
      </div>

      <div className="analyticsCards">
        <div className="analyticsCard analyticsCardTotal">
          <div className="analyticsCardLabel">{t("Total Staff")}</div>
          <div className="analyticsCardValue">
            {employeesLoading ? "—" : totalStaff}
          </div>
          <div className="analyticsCardSub">
            {outletsLoading
              ? "—"
              : `${isScoped && rowFilterOutletId ? 1 : outlets.length} ${t("Outlets")}`}
          </div>
        </div>
        <div className="analyticsCard analyticsCardPresent">
          <div className="analyticsCardLabel">{t("Present Today")}</div>
          <div className="analyticsCardValue">
            {employeesLoading || attendancesLoading ? "—" : presentTodayCount}
          </div>
          <div className="analyticsCardSub">
            {totalStaff > 0 && !employeesLoading && !attendancesLoading
              ? `${pctPresent}% ${t("Present")}`
              : ""}
          </div>
        </div>
      </div>

      <div className="analyticsTableSection">
        <h2 className="analyticsTableTitle">{t("Daily Attendance")}</h2>
        <div className="analyticsTableWrap">
          <table className="analyticsTable">
            <thead>
              <tr>
                <th>{t("Employee ID")}</th>
                <th>{t("Name")}</th>
                <th>{t("Clock In")}</th>
                <th>{t("Clock Out")}</th>
                <th>{t("Status")}</th>
                <th>{t("Total Hours")}</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {attendancesLoading ? (
                <tr>
                  <td colSpan={7}>{t("Loading…")}</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>{t("No attendance records yet.")}</td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const name = row.employee?.name ?? row.user?.fullName ?? "—";
                  const empCode = row.employee?.employeeId ?? "—";
                  const statusLabel = row.status ? "Present" : "Absent";
                  return (
                    <tr key={row.id}>
                      <td>{empCode}</td>
                      <td>{name}</td>
                      <td>{formatTime(row.clockIn)}</td>
                      <td>{formatTime(row.clockOut ?? undefined)}</td>
                      <td>
                        <span
                          className={`analyticsPill analyticsPill${statusLabel}`}
                        >
                          {t(statusLabel)}
                        </span>
                      </td>
                      <td>{formatHours(row.hoursWorked ?? undefined)}</td>
                      <td>
                        <button
                          type="button"
                          className="analyticsRowAction"
                          aria-label={t("More options")}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
