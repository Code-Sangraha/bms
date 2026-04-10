import { apiRequest } from "@/lib/api/client";
import { ATTENDANCE_ROUTES } from "@/lib/api/routes";

/** Request body for clock-in / clock-out (both IDs optional in API; send at least employeeId). */
export type ClockPayload = {
  employeeId?: string;
  userId?: string;
};

export type AttendanceEmployee = {
  employeeId: string;
  name: string;
  outletId: string;
};

export type AttendanceUser = {
  fullName: string;
  email: string;
  outletId: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employee?: AttendanceEmployee;
  userId: string;
  user?: AttendanceUser;
  clockIn: string;
  clockOut?: string | null;
  hoursWorked?: number | null;
  status: boolean;
};

export type ClockInResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
    employeeId: string;
    userId: string;
    clockIn: string;
    status: boolean;
  };
};

export type ClockOutResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
    employeeId: string;
    clockOut: string;
    hoursWorked: number;
  };
};

export type GetAttendancesResponse = {
  success?: boolean;
  message?: string;
  data?: AttendanceRecord[];
};

type ApiResult<T extends { success?: boolean; message?: string }> =
  | { data: T; ok: true }
  | { ok: false; error: string; status: number };

/** Treat HTTP 200 + `success: false` as an error (some endpoints return this shape). */
async function attendanceRequest<T extends { success?: boolean; message?: string }>(
  route: string,
  options: RequestInit
): Promise<ApiResult<T>> {
  const result = await apiRequest<T>(route, options);
  if (!result.ok) return result;
  if (result.data.success === false) {
    return {
      ok: false,
      error: typeof result.data.message === "string" ? result.data.message : "Request failed.",
      status: 200,
    };
  }
  return result;
}

export async function getAttendances() {
  return attendanceRequest<GetAttendancesResponse>(ATTENDANCE_ROUTES.GET, {
    method: "GET",
  });
}

export async function clockIn(payload: ClockPayload | string) {
  const body: ClockPayload = typeof payload === "string" ? { employeeId: payload } : payload;
  return attendanceRequest<ClockInResponse>(ATTENDANCE_ROUTES.CLOCK_IN, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function clockOut(payload: ClockPayload | string) {
  const body: ClockPayload = typeof payload === "string" ? { employeeId: payload } : payload;
  return attendanceRequest<ClockOutResponse>(ATTENDANCE_ROUTES.CLOCK_OUT, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
