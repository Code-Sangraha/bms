import { apiRequest } from "@/lib/api/client";
import { AUTH_ROUTES } from "@/lib/api/routes";
import { getRefreshToken } from "@/lib/auth/token";

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
  refreshToken?: string;
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

/** Get refresh token from login API response. */
export function getRefreshTokenFromAuthResponse(response: LoginResponse): string | undefined {
  const data = response.data ?? response;
  return (data as AuthResponseData).refreshToken;
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

export type RefreshResponse = {
  success?: boolean;
  data?: { accessToken?: string; refreshToken?: string };
  [key: string]: unknown;
};

/** Call refresh endpoint to get new access (and optionally refresh) token. Does not use apiRequest to avoid 401 retry loop. */
export async function refreshTokens(): Promise<
  { ok: true; accessToken: string; refreshToken?: string } | { ok: false; error: string }
> {
  const baseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) return { ok: false, error: "API URL not configured" };

  const refreshToken = typeof window !== "undefined" ? getRefreshToken() : null;
  if (!refreshToken) return { ok: false, error: "No refresh token" };

  const res = await fetch(`${baseUrl}${AUTH_ROUTES.REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as RefreshResponse;
  if (!res.ok) {
    const msg = (data as { message?: string }).message ?? "Refresh failed";
    return { ok: false, error: typeof msg === "string" ? msg : "Refresh failed" };
  }
  const accessToken = data.data?.accessToken;
  if (!accessToken) return { ok: false, error: "No access token in refresh response" };
  return {
    ok: true,
    accessToken,
    refreshToken: data.data?.refreshToken,
  };
}
