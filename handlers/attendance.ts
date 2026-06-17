import axios from "axios";
import { apiRequest, getBaseUrl, tryRefresh } from "@/lib/api/client";
import { ATTENDANCE_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

/** Clock-in/out identity; backend prefers userId when both are provided. */
export type ClockPayload = {
  userId?: string;
  employeeId?: string;
};

export type AttendanceEmployee = {
  employeeId: string;
  name: string;
  outletId: string;
};

export type AttendanceUser = {
  id?: string;
  fullName: string;
  email: string;
  outletId: string;
};

export type AttendanceRecord = {
  id: string;
  /** May be null when the backend clocks in by user id only. */
  employeeId?: string | null;
  employee?: AttendanceEmployee;
  userId?: string | null;
  user?: AttendanceUser;
  clockIn: string;
  clockOut?: string | null;
  hoursWorked?: number | null;
  isClockedIn?: boolean;
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ClockInResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
    employeeId?: string | null;
    userId?: string | null;
    clockIn: string;
    clockOut?: string | null;
    hoursWorked?: number | null;
    isClockedIn?: boolean;
    status: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type ClockOutResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
    employeeId?: string | null;
    userId?: string | null;
    clockIn?: string;
    clockOut: string;
    hoursWorked: number;
    isClockedIn?: boolean;
    status?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type AttendancePeriod = "day" | "week" | "month";

/** Aggregated row from GET /attendances/get (analytics, not session records). */
export type AttendanceAnalyticsRow = {
  id: string;
  type: "employee" | "user";
  name: string;
  outletId: string;
  totalHoursWorked: number;
  presentDays: number;
};

export type GetAttendanceAnalyticsResponse = {
  success?: boolean;
  message?: string;
  data?: AttendanceAnalyticsRow[];
};

/** @deprecated Use GetAttendanceAnalyticsResponse — backend returns aggregated rows. */
export type GetAttendancesResponse = GetAttendanceAnalyticsResponse;

export type TodayAttendanceStatusResponse = {
  success?: boolean;
  message?: string;
  data?: AttendanceRecord | null;
};

type ApiResult<T extends { success?: boolean; message?: string }> =
  | { data: T; ok: true }
  | { ok: false; error: string; status: number };

function errorMessageFromPayload(data: unknown): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const msg = o.message ?? o.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return "Request failed.";
}

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

export type AttendanceAnalyticsFilters = {
  outletId?: string | null;
  period?: AttendancePeriod | null;
};

/** Build GET body for `/attendances/get`; backend reads `req.body` (axios — fetch cannot attach GET bodies). */
function buildAttendanceAnalyticsBody(
  filters: AttendanceAnalyticsFilters = {}
): Record<string, string> {
  const body: Record<string, string> = {};
  const outletId = filters.outletId;
  if (typeof outletId === "string" && outletId.trim() !== "") {
    body.outletId = outletId.trim();
  }
  const period = filters.period;
  if (period === "day" || period === "week" || period === "month") {
    body.period = period;
  }
  return body;
}

export async function getAttendanceAnalytics(
  filters: AttendanceAnalyticsFilters = {}
): Promise<ApiResult<GetAttendanceAnalyticsResponse>> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return { ok: false, error: "API URL not configured", status: 0 };

  const url = `${baseUrl}${ATTENDANCE_ROUTES.GET}`;
  const body = buildAttendanceAnalyticsBody(filters);

  const requestWithToken = (token: string | null) =>
    axios.get<GetAttendanceAnalyticsResponse>(url, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      withCredentials: true,
      validateStatus: () => true,
    });

  try {
    let token = getAuthToken();
    let res = await requestWithToken(token);

    if (res.status === 401) {
      const newToken = await tryRefresh();
      if (newToken) {
        token = newToken;
        res = await requestWithToken(token);
      } else {
        clearAuthToken();
        clearStoredUser();
      }
    }

    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        error: errorMessageFromPayload(res.data),
        status: res.status,
      };
    }

    const payload = res.data ?? {};
    if (payload.success === false) {
      return {
        ok: false,
        error: errorMessageFromPayload(payload),
        status: res.status,
      };
    }

    return { ok: true, data: payload as GetAttendanceAnalyticsResponse };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

/** @deprecated Use getAttendanceAnalytics({ outletId, period }). */
export async function getAttendances(
  outletFilter: string | null | undefined = undefined,
  period?: AttendancePeriod | null
): Promise<ApiResult<GetAttendanceAnalyticsResponse>> {
  return getAttendanceAnalytics({ outletId: outletFilter, period });
}

export async function getTodayAttendanceStatus(): Promise<ApiResult<TodayAttendanceStatusResponse>> {
  return attendanceRequest<TodayAttendanceStatusResponse>(ATTENDANCE_ROUTES.TODAY_STATUS, {
    method: "GET",
  });
}

/** Sends optional userId/employeeId; JWT still authenticates the request. */
export async function clockIn(payload: ClockPayload = {}): Promise<ApiResult<ClockInResponse>> {
  return attendanceRequest<ClockInResponse>(ATTENDANCE_ROUTES.CLOCK_IN, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Sends optional userId/employeeId; JWT still authenticates the request. */
export async function clockOut(payload: ClockPayload = {}): Promise<ApiResult<ClockOutResponse>> {
  return attendanceRequest<ClockOutResponse>(ATTENDANCE_ROUTES.CLOCK_OUT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
