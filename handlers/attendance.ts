import axios from "axios";
import { apiRequest, getBaseUrl, tryRefresh } from "@/lib/api/client";
import { ATTENDANCE_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

/** Deprecated: clock-in/out use JWT-only identity; bodies are `{}`. Kept for shared types if needed. */
export type ClockPayload = Record<string, never>;

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

/** Build GET body for `/attendances/get`; backend reads `req.body.outletId` (axios — fetch cannot attach GET bodies). */
function buildGetAttendancesBody(outletId: string | null | undefined): Record<string, string> | Record<string, never> {
  if (typeof outletId === "string" && outletId.trim() !== "") {
    return { outletId: outletId.trim() };
  }
  return {};
}

export async function getAttendances(
  outletFilter: string | null | undefined = undefined
): Promise<ApiResult<GetAttendancesResponse>> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return { ok: false, error: "API URL not configured", status: 0 };

  const url = `${baseUrl}${ATTENDANCE_ROUTES.GET}`;
  const body = buildGetAttendancesBody(outletFilter);

  const requestWithToken = (token: string | null) =>
    axios.get<GetAttendancesResponse>(url, {
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

    return { ok: true, data: payload as GetAttendancesResponse };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}

/** JWT determines who is clocking in/out; sends empty JSON object. */
export async function clockIn(): Promise<ApiResult<ClockInResponse>> {
  return attendanceRequest<ClockInResponse>(ATTENDANCE_ROUTES.CLOCK_IN, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** JWT determines who is clocking in/out; sends empty JSON object. */
export async function clockOut(): Promise<ApiResult<ClockOutResponse>> {
  return attendanceRequest<ClockOutResponse>(ATTENDANCE_ROUTES.CLOCK_OUT, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
