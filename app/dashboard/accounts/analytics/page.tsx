"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LuClock, LuUsers } from "react-icons/lu";
import { useI18n } from "@/app/providers/I18nProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import {
  getAttendanceAnalytics,
  type AttendanceAnalyticsRow,
  type AttendancePeriod,
} from "@/handlers/attendance";
import { getEmployees } from "@/handlers/employee";
import { getOutlets } from "@/handlers/outlet";
import "./analytics.scss";

const EMPLOYEES_QUERY_KEY = ["employees"];
const OUTLETS_QUERY_KEY = ["outlets"];

type PeriodFilter = AttendancePeriod;

const PERIOD_OPTIONS: { value: PeriodFilter; labelKey: string }[] = [
  { value: "day", labelKey: "Today" },
  { value: "week", labelKey: "This week" },
  { value: "month", labelKey: "This month" },
];

type DisplayRow = {
  key: string;
  name: string;
  type: AttendanceAnalyticsRow["type"];
  outletId: string;
  presentDays: number;
  totalHoursWorked: number;
};

function analyticsRowKey(row: AttendanceAnalyticsRow): string {
  return `${row.type}:${row.id}`;
}

function findAnalyticsForEmployee(
  employee: { id: string; userId?: string },
  byKey: Map<string, AttendanceAnalyticsRow>
): AttendanceAnalyticsRow | undefined {
  const asEmployee = byKey.get(`employee:${employee.id}`);
  if (asEmployee) return asEmployee;
  if (employee.userId) {
    const asUser = byKey.get(`user:${employee.userId}`);
    if (asUser) return asUser;
  }
  return undefined;
}

function buildDisplayRows(
  employeesInScope: Array<{ id: string; name: string; outletId: string; userId?: string }>,
  analyticsRows: AttendanceAnalyticsRow[]
): DisplayRow[] {
  const byKey = new Map(analyticsRows.map((row) => [analyticsRowKey(row), row]));
  const matchedKeys = new Set<string>();
  const rows: DisplayRow[] = [];

  for (const employee of employeesInScope) {
    const match = findAnalyticsForEmployee(employee, byKey);
    if (match) matchedKeys.add(analyticsRowKey(match));
    rows.push({
      key: `employee:${employee.id}`,
      name: employee.name,
      type: match?.type ?? "employee",
      outletId: employee.outletId,
      presentDays: match?.presentDays ?? 0,
      totalHoursWorked: match?.totalHoursWorked ?? 0,
    });
  }

  for (const row of analyticsRows) {
    const key = analyticsRowKey(row);
    if (matchedKeys.has(key)) continue;
    rows.push({
      key,
      name: row.name,
      type: row.type,
      outletId: row.outletId,
      presentDays: row.presentDays ?? 0,
      totalHoursWorked: row.totalHoursWorked ?? 0,
    });
  }

  return rows.sort((a, b) => {
    if (b.presentDays !== a.presentDays) return b.presentDays - a.presentDays;
    return a.name.localeCompare(b.name);
  });
}

function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return "—";
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export default function AccountsAnalyticsPage() {
  const navigate = useNavigate();
  const [outletFilter, setOutletFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const { t } = useI18n();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();

  useEffect(() => {
    if (isScoped && rowFilterOutletId) setOutletFilter(rowFilterOutletId);
  }, [isScoped, rowFilterOutletId]);

  const effectiveOutletKey =
    isScoped && rowFilterOutletId ? rowFilterOutletId : outletFilter;

  const apiPeriod: AttendancePeriod = periodFilter;

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

  const outletMap = useMemo(
    () => new Map(outlets.map((o) => [o.id, o.name])),
    [outlets]
  );

  const {
    data: analyticsRows = [],
    isLoading: attendancesLoading,
    isFetching: attendancesFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: [
      "attendanceAnalytics",
      effectiveOutletKey === "all" ? "all" : effectiveOutletKey,
      periodFilter,
    ],
    queryFn: async () => {
      const outletArg = effectiveOutletKey === "all" ? null : effectiveOutletKey;
      const result = await getAttendanceAnalytics({
        outletId: outletArg,
        period: apiPeriod,
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      const list = result.data.data ?? [];
      return Array.isArray(list) ? list : [];
    },
  });

  const employeesInScope = useMemo(() => {
    if (effectiveOutletKey === "all") {
      return isScoped && rowFilterOutletId
        ? employees.filter((e) => e.outletId === rowFilterOutletId)
        : employees;
    }
    return employees.filter((e) => e.outletId === effectiveOutletKey);
  }, [employees, effectiveOutletKey, isScoped, rowFilterOutletId]);

  const filteredRows = useMemo(() => {
    if (effectiveOutletKey === "all") return analyticsRows;
    return analyticsRows.filter((r) => r.outletId === effectiveOutletKey);
  }, [analyticsRows, effectiveOutletKey]);

  const displayRows = useMemo(
    () => buildDisplayRows(employeesInScope, filteredRows),
    [employeesInScope, filteredRows]
  );

  const activeInPeriod = useMemo(
    () => displayRows.filter((r) => r.presentDays > 0).length,
    [displayRows]
  );

  const totalPresentDays = useMemo(
    () => displayRows.reduce((sum, r) => sum + r.presentDays, 0),
    [displayRows]
  );

  const totalHoursInPeriod = useMemo(
    () => displayRows.reduce((sum, r) => sum + (r.totalHoursWorked ?? 0), 0),
    [displayRows]
  );

  const totalStaff = employeesInScope.length;
  const pctActive =
    totalStaff > 0 ? Math.round((activeInPeriod / totalStaff) * 100) : 0;

  const lastUpdatedLabel =
    attendancesFetching && !dataUpdatedAt
      ? t("Loading…")
      : dataUpdatedAt
        ? new Date(dataUpdatedAt).toLocaleTimeString()
        : "";

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === periodFilter)?.labelKey ?? "";

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
          <div className="analyticsPeriodSegment" role="group" aria-label={t("Time period")}>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`analyticsPeriodBtn${periodFilter === opt.value ? " analyticsPeriodBtnActive" : ""}`}
                onClick={() => setPeriodFilter(opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          {!isScoped ? (
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
          ) : null}
          <span className="analyticsLastSync">
            {lastUpdatedLabel ? `${t("Last updated")}: ${lastUpdatedLabel}` : ""}
          </span>
        </div>
      </div>

      <div className="analyticsCards">
        <div className="analyticsCard analyticsCardTotal">
          <div className="analyticsCardIconWrap">
            <LuUsers aria-hidden />
          </div>
          <div className="analyticsCardLabel">{t("Total Staff")}</div>
          <div className="analyticsCardValue">
            {employeesLoading ? "—" : totalStaff}
          </div>
          <div className="analyticsCardSub">
            {outletsLoading
              ? "—"
              : isScoped
                ? `1 ${t("Outlets")}`
                : `${outlets.length} ${t("Outlets")}`}
          </div>
        </div>
        <div className="analyticsCard analyticsCardPresent">
          <div className="analyticsCardIconWrap">
            <LuUsers aria-hidden />
          </div>
          <div className="analyticsCardLabel">{t("Active in period")}</div>
          <div className="analyticsCardValue">
            {employeesLoading || attendancesLoading ? "—" : activeInPeriod}
          </div>
          <div className="analyticsCardSub">
            {totalStaff > 0 && !employeesLoading && !attendancesLoading
              ? `${pctActive}% · ${t(periodLabel)}`
              : t(periodLabel)}
          </div>
        </div>
        <div className="analyticsCard analyticsCardSessions">
          <div className="analyticsCardIconWrap">
            <LuClock aria-hidden />
          </div>
          <div className="analyticsCardLabel">{t("Present days")}</div>
          <div className="analyticsCardValue">
            {attendancesLoading ? "—" : totalPresentDays}
          </div>
          <div className="analyticsCardSub">{t("Total sessions in period")}</div>
        </div>
        <div className="analyticsCard analyticsCardHours">
          <div className="analyticsCardIconWrap">
            <LuClock aria-hidden />
          </div>
          <div className="analyticsCardLabel">{t("Total hours")}</div>
          <div className="analyticsCardValue">
            {attendancesLoading ? "—" : formatHours(totalHoursInPeriod)}
          </div>
          <div className="analyticsCardSub">{t(periodLabel)}</div>
        </div>
      </div>

      <div className="analyticsTableSection">
        <div className="analyticsTableSectionHead">
          <h2 className="analyticsTableTitle">{t("Staff attendance summary")}</h2>
          <p className="analyticsTableHint">
            {t("Present days counts attendance sessions in the selected period.")}
          </p>
        </div>
        <div className="analyticsTableWrap">
          <table className="analyticsTable">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Type")}</th>
                <th>{t("Outlet")}</th>
                <th>{t("Present days")}</th>
                <th>{t("Total Hours")}</th>
              </tr>
            </thead>
            <tbody>
              {attendancesLoading || employeesLoading ? (
                <tr>
                  <td colSpan={5}>{t("Loading…")}</td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="analyticsEmptyState">
                      <LuClock className="analyticsEmptyIcon" aria-hidden />
                      <p>{t("No attendance records yet.")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr key={row.key}>
                    <td className="analyticsCellName">{row.name || "—"}</td>
                    <td>
                      <span
                        className={`analyticsTypeBadge analyticsTypeBadge${row.type === "employee" ? "Employee" : "User"}`}
                      >
                        {row.type === "employee" ? t("Employee") : t("User")}
                      </span>
                    </td>
                    <td>{outletMap.get(row.outletId) ?? row.outletId ?? "—"}</td>
                    <td>
                      <span
                        className={`analyticsPresentDays${row.presentDays > 0 ? " analyticsPresentDaysActive" : ""}`}
                      >
                        {row.presentDays}
                      </span>
                    </td>
                    <td>{formatHours(row.totalHoursWorked)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
