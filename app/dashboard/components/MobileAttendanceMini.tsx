"use client";

import { Link } from "react-router-dom";
import { buildPathWithOutletScope } from "@/lib/outletScope";

type MobileAttendanceMiniProps = {
  scopedOutletId: string | null;
  search: string;
  presentToday: number;
  totalStaff: number;
  totalHours: number;
  t: (key: string) => string;
};

export default function MobileAttendanceMini({
  scopedOutletId,
  search,
  presentToday,
  totalStaff,
  totalHours,
  t,
}: MobileAttendanceMiniProps) {
  const to = (path: string) => buildPathWithOutletScope(path, scopedOutletId, search);
  const attendancePercentage = totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;

  return (
    <div className="mobileAttendanceMini">
      <div className="mobileAttendanceMini__header">
        <h3 className="mobileAttendanceMini__title">{t("Attendance")}</h3>
        <Link to={to("/dashboard/accounts/analytics")} className="mobileAttendanceMini__viewAll">
          {t("View All")} →
        </Link>
      </div>
      <div className="mobileAttendanceMini__grid">
        <div className="mobileAttendanceMini__card">
          <span className="mobileAttendanceMini__label">{t("Present")}</span>
          <span className="mobileAttendanceMini__value">
            {presentToday}/{totalStaff}
          </span>
          <span className="mobileAttendanceMini__subtext">{attendancePercentage}%</span>
        </div>
        <div className="mobileAttendanceMini__card">
          <span className="mobileAttendanceMini__label">{t("Hours")}</span>
          <span className="mobileAttendanceMini__value">{totalHours.toFixed(1)}h</span>
          <span className="mobileAttendanceMini__subtext">{t("Today")}</span>
        </div>
      </div>
    </div>
  );
}
