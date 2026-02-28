"use client";

import { useState } from "react";
import "./analytics.scss";

const STATIC_ATTENDANCE = [
  { employeeId: "EMP001", name: "John Smith", clockIn: "07:00", clockOut: "16:00", status: "Present" as const, totalHours: "9hrs" },
  { employeeId: "EMP002", name: "Maria Garcia", clockIn: "07:00", clockOut: "16:00", status: "Present" as const, totalHours: "9hrs" },
  { employeeId: "EMP003", name: "David Chen", clockIn: "—", clockOut: "—", status: "Absent" as const, totalHours: "—" },
];

export default function AccountsAnalyticsPage() {
  const [outletFilter, setOutletFilter] = useState("all");

  return (
    <section className="analyticsPage">
      <div className="breadcrumb">
        <span>Accounts</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>Analytics</span>
      </div>

      <div className="analyticsHeader">
        <div className="analyticsHeaderText">
          <h1 className="pageTitle">Analytics</h1>
          <p className="pageSubtitle">Track staff attendance and working hours.</p>
        </div>
        <div className="analyticsToolbar">
          <select
            className="analyticsOutletSelect"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            aria-label="Filter by outlet"
          >
            <option value="all">All Outlets</option>
          </select>
          <span className="analyticsLastSync">Last sync: 2mins</span>
        </div>
      </div>

      <div className="analyticsCards">
        <div className="analyticsCard analyticsCardTotal">
          <div className="analyticsCardLabel">Total Staff</div>
          <div className="analyticsCardValue">32</div>
          <div className="analyticsCardSub">4 departments</div>
        </div>
        <div className="analyticsCard analyticsCardPresent">
          <div className="analyticsCardLabel">Present Today</div>
          <div className="analyticsCardValue">20</div>
          <div className="analyticsCardSub">70% present</div>
        </div>
      </div>

      <div className="analyticsTableSection">
        <h2 className="analyticsTableTitle">Daily Attendance</h2>
        <div className="analyticsTableWrap">
          <table className="analyticsTable">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
                <th>Total Hours</th>
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
                      {row.status}
                    </span>
                  </td>
                  <td>{row.totalHours}</td>
                  <td>
                    <button
                      type="button"
                      className="analyticsRowAction"
                      aria-label="More options"
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
