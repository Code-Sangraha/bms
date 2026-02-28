"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const router = useRouter();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockError, setClockError] = useState<string | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: async () => {
      const result = await getEmployees();
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
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
        if (result.status === 401) router.push("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError("Something went wrong. Please try again."),
  });

  const clockOutMutation = useMutation({
    mutationFn: (employeeId: string) => clockOutApi(employeeId),
    onSuccess: (result) => {
      if (result.ok) {
        setIsClockedIn(false);
        setClockError(null);
      } else {
        if (result.status === 401) router.push("/login");
        else setClockError(result.error);
      }
    },
    onError: () => setClockError("Something went wrong. Please try again."),
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
      setClockError("Please select an employee.");
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
        <span>Staff Management</span> {"›"} Clock-IN/OUT
      </div>

      <div className="clockInOutHeader">
        <div className="clockInOutHeaderText">
          <h1 className="pageTitle">Clock-IN/OUT</h1>
          <p className="pageSubtitle">
            Track staff attendance and working hours
          </p>
        </div>
      </div>

      <div className="clockInOutLayout">
        <div className="clockInOutCard">
          <span className="clockInOutLabel">Clock in</span>
          <div className="clockInOutTimer">
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(h).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">HOURS</span>
            </div>
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(m).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">MINUTES</span>
            </div>
            <div className="clockInOutTimerBox">
              <span className="clockInOutTimerValue">{String(s).padStart(2, "0")}</span>
              <span className="clockInOutTimerUnit">SECONDS</span>
            </div>
          </div>
          <p className="clockInOutHint">
            {isClockedIn
              ? "You are clocked in. Click Clock-OUT when you finish."
              : "Start tracking your time by clocking in."}
          </p>
          {employees.length > 0 && (
            <div className="clockInOutSelectWrap">
              <select
                className="clockInOutSelect"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                aria-label="Select employee"
                disabled={isClockedIn}
              >
                <option value="">Select employee</option>
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
              {loading ? "Processing…" : "Clock-OUT"}
            </button>
          ) : (
            <button
              type="button"
              className="clockInOutBtn clockInOutBtnPrimary"
              onClick={handleClockIn}
              disabled={loading || !selectedEmployeeId}
            >
              {loading ? "Processing…" : "Clock-IN"}
            </button>
          )}
        </div>

        <div className="clockInOutStats">
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">Weekly Work</span>
            <span className="clockInOutStatValue">14h 30m</span>
            <span className="clockInOutStatSub">This week</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">Present Today</span>
            <span className="clockInOutStatValue">20</span>
            <span className="clockInOutStatSub">70% present</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">Absent Today</span>
            <span className="clockInOutStatValue">1</span>
            <span className="clockInOutStatSub">This week</span>
          </div>
          <div className="clockInOutStatCard">
            <span className="clockInOutStatTitle">Total Staff</span>
            <span className="clockInOutStatValue">20</span>
            <span className="clockInOutStatSub">Total Staff</span>
          </div>
        </div>
      </div>
    </section>
  );
}
