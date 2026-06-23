import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import DashboardKPIGrid, { type KPICard } from "./DashboardKPIGrid";
import { formatDashboardAttendanceHours } from "../utils/dashboardFormatting";

type AttendanceRow = {
  id: string;
  name: string;
  sessions: number;
  hours: string;
  status: "Present" | "Absent";
};

type DashboardAttendanceSectionProps = {
  totalStaff: number;
  presentToday: number;
  totalHours: number;
  outletsCount: number;
  effectiveOutletScopeId: string | null;
  outlets: Array<{ id: string; name: string }>;
  dashboardAttendanceTableRows: AttendanceRow[];
  dayAttendanceLoading: boolean;
  t: (key: string) => string;
};

export default function DashboardAttendanceSection({
  totalStaff,
  presentToday,
  totalHours,
  outletsCount,
  effectiveOutletScopeId,
  outlets,
  dashboardAttendanceTableRows,
  dayAttendanceLoading,
  t,
}: DashboardAttendanceSectionProps) {
  const pct = totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;

  const kpiCards: KPICard[] = [
    {
      label: t("Total Staff"),
      value: dayAttendanceLoading ? "—" : String(totalStaff),
      sub: effectiveOutletScopeId
        ? t("In selected outlet")
        : `${outletsCount} ${t("Outlets")}`,
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      toneClassName: "dashboardKPICardStaff",
    },
    {
      label: t("Present Today"),
      value: dayAttendanceLoading ? "—" : String(presentToday),
      sub: totalStaff > 0 ? `${pct}% attendance` : t("No data"),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      toneClassName: "dashboardKPICardPresent",
    },
    {
      label: t("Total Hours"),
      value: dayAttendanceLoading ? "—" : formatDashboardAttendanceHours(totalHours),
      sub: t("All staff"),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      toneClassName: "dashboardKPICardWeight",
    },
  ];

  return (
    <div className="dashboardAttendanceSection">
      <div className="dashboardSectionHead">
        <h2 className="dashboardSectionTitle">{t("Attendance")}</h2>
      </div>

      <DashboardKPIGrid cards={kpiCards} />

      {dashboardAttendanceTableRows.length === 0 && !dayAttendanceLoading && (
        <EmptyState title={t("No attendance records yet.")} />
      )}

      {dashboardAttendanceTableRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Present Days")}</TableHead>
                <TableHead>{t("Total Hours")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardAttendanceTableRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.sessions}</TableCell>
                  <TableCell>{row.hours}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "Present" ? "success" : "warning"}>
                      {t(row.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
