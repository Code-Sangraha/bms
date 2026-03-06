"use client";

import { useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import "./analytics.scss";

const STATIC_ATTENDANCE = [
  { employeeId: "EMP001", name: "John Smith", clockIn: "07:00", clockOut: "16:00", status: "Present" as const, totalHours: "9hrs" },
  { employeeId: "EMP002", name: "Maria Garcia", clockIn: "07:00", clockOut: "16:00", status: "Present" as const, totalHours: "9hrs" },
  { employeeId: "EMP003", name: "David Chen", clockIn: "—", clockOut: "—", status: "Absent" as const, totalHours: "—" },
];

export default function AccountsAnalyticsPage() {
  const [outletFilter, setOutletFilter] = useState("all");
  const { t } = useI18n();

  return (
    <section className="analyticsPage">
      <div className="breadcrumb">
        <span>{t("Accounts")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Analytics")}</span>
      </div>

      <div className="analyticsHeader">
        <div className="analyticsHeaderText">
          <h1 className="pageTitle">{t("Analytics")}</h1>
          <p className="pageSubtitle">{t("Track staff attendance and working hours.")}</p>
        </div>
        <div className="analyticsToolbar">
          <select
            className="analyticsOutletSelect"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            aria-label={t("Filter by outlet")}
          >
            <option value="all">{t("All Outlets")}</option>
          </select>
          <span className="analyticsLastSync">{t("Last sync: 2mins")}</span>
        </div>
      </div>

      <div className="analyticsCards">
        <div className="analyticsCard analyticsCardTotal">
          <div className="analyticsCardLabel">{t("Total Staff")}</div>
          <div className="analyticsCardValue">32</div>
          <div className="analyticsCardSub">{t("4 departments")}</div>
        </div>
        <div className="analyticsCard analyticsCardPresent">
          <div className="analyticsCardLabel">{t("Present Today")}</div>
          <div className="analyticsCardValue">20</div>
          <div className="analyticsCardSub">{t("70% present")}</div>
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
              {STATIC_ATTENDANCE.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.employeeId}</td>
                  <td>{row.name}</td>
                  <td>{row.clockIn}</td>
                  <td>{row.clockOut}</td>
                  <td>
                    <span className={`analyticsPill analyticsPill${row.status}`}>
                      {t(row.status)}
                    </span>
                  </td>
                  <td>{t(row.totalHours)}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
