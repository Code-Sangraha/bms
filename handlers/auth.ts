import { apiRequest } from "@/lib/api/client";
import { AUTH_ROUTES } from "@/lib/api/routes";

const DEFAULT_ROLE_ID = "4e01f811-3fb2-4a1c-a237-4ee46ef982d5";

export type RegisterPayload = {
  email: string;
  userName: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  roleId: string;
  status: boolean;
};

export type AuthResponseData = {
  success?: boolean;
  message?: string;
  accessToken?: string;
  token?: string;
  user?: {
    id?: string;
    outletId?: string | null;
    outlet?: { id?: string; name?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type RegisterResponse = {
  success?: boolean;
  message?: string;
  data?: AuthResponseData;
  [key: string]: unknown;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  success?: boolean;
  message?: string;
  data?: AuthResponseData;
  accessToken?: string;
  token?: string;
  [key: string]: unknown;
};

/** Get stored auth token from login/register API response (handles data.accessToken or data.token) */
export function getTokenFromAuthResponse(response: LoginResponse | RegisterResponse): string | undefined {
  const data = response.data ?? response;
  return (data as AuthResponseData).accessToken ?? (data as AuthResponseData).token;
}

/** Get user from login/register API response for storing outletId (Manager/Staff). */
export function getUserFromAuthResponse(response: LoginResponse | RegisterResponse): AuthResponseData["user"] {
  const data = response.data ?? response;
  return (data as AuthResponseData).user;
}

export async function register(payload: Omit<RegisterPayload, "roleId" | "status">) {
  const body: RegisterPayload = {
    ...payload,
    roleId: DEFAULT_ROLE_ID,
    status: true,
  };
  return apiRequest<RegisterResponse>(AUTH_ROUTES.REGISTER, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function login(payload: LoginPayload) {
  return apiRequest<LoginResponse>(AUTH_ROUTES.LOGIN, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiRequest<{ success?: boolean; message?: string }>(AUTH_ROUTES.LOGOUT, {
    method: "POST",
  });
}
