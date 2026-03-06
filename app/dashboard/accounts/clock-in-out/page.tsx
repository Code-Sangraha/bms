"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import { getEmployees } from "@/handlers/employee";
import { clockIn as clockInApi, clockOut as clockOutApi } from "@/handlers/attendance";
import "./clock-in-out.scss";

const EMPLOYEES_QUERY_KEY = ["employees"];

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return { h, m, s };
}

export default function ClockInOutPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockError, setClockError] = useState<string | null>(null);

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

  const clockInMutation = useMutation({
    mutationFn: (employeeId: string) => clockInApi(employeeId),
    onSuccess: (result) => {
      if (result.ok) {
        setIsClockedIn(true);
        setElapsedSeconds(0);
        setClockError(null);
      } else {
        if (result.status === 401) navigate("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  const clockOutMutation = useMutation({
    mutationFn: (employeeId: string) => clockOutApi(employeeId),
    onSuccess: (result) => {
      if (result.ok) {
        setIsClockedIn(false);
        setClockError(null);
      } else {
        if (result.status === 401) navigate("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError(t("Something went wrong. Please try again.")),
  });

  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn]);

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

  return (
    <section className="clockInOutPage">
      <div className="breadcrumb">
        <span>{t("Staff Management")}</span> {"›"} {t("Clock-IN/OUT")}
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
            <span className="clockInOutStatValue">{t("14h 30m")}</span>
            <span className="clockInOutStatSub">{t("This week")}</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Present Today")}</span>
            <span className="clockInOutStatValue">20</span>
            <span className="clockInOutStatSub">{t("70% present")}</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Absent Today")}</span>
            <span className="clockInOutStatValue">1</span>
            <span className="clockInOutStatSub">{t("This week")}</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">{t("Total Staff")}</span>
            <span className="clockInOutStatValue">20</span>
            <span className="clockInOutStatSub">{t("Total Staff")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
