import { apiRequest } from "@/lib/api/client";
import { ATTENDANCE_ROUTES } from "@/lib/api/routes";

export type ClockInResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export type ClockOutResponse = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function clockIn(employeeId: string) {
  return apiRequest<ClockInResponse>(ATTENDANCE_ROUTES.CLOCK_IN, {
    method: "POST",
    body: JSON.stringify({ employeeId }),
  });
}

export async function clockOut(employeeId: string) {
  return apiRequest<ClockOutResponse>(ATTENDANCE_ROUTES.CLOCK_OUT, {
    method: "POST",
    body: JSON.stringify({ employeeId }),
  });
}
