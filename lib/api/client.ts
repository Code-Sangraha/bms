import { AUTH_ROUTES } from "@/lib/api/routes";
import { notifyAuthContextUpdated } from "@/lib/auth/authEvents";
import { syncStoredOutletFromAccessToken } from "@/lib/auth/role";
import { clearAuthToken, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

export const getBaseUrl = (): string => {
  const configuredBaseUrl = (import.meta.env.VITE_API_URL ?? "").trim();
  if (!configuredBaseUrl) return "";
  // Express mounts `/v1` (lowercase). Normalize a trailing `/V1` from env so requests hit registered routes.
  return configuredBaseUrl.replace(/\/$/, "").replace(/\/V1$/i, "/v1");
};

export type ApiError = {
  message?: string;
  error?: string;
};

async function doRequest<T>(
  url: string,
  headers: HeadersInit,
  options: RequestInit
): Promise<{ res: Response; data: T & ApiError }> {
  const res = await fetch(url, { ...options, headers, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  return { res, data };
}

/** Call refresh endpoint; returns new access token or null. Does not use apiRequest to avoid 401 loop. */
export async function tryRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${baseUrl}${AUTH_ROUTES.REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Backend expects { token } for refresh endpoint.
    body: JSON.stringify({ token: refreshToken }),
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    data?: { accessToken?: string; refreshToken?: string; token?: string };
  };
  const accessToken = data.data?.accessToken ?? data.accessToken ?? data.data?.token ?? data.token;
  const nextRefreshToken = data.data?.refreshToken ?? data.refreshToken;
  if (!res.ok || !accessToken) return null;
  setAuthToken(accessToken);
  syncStoredOutletFromAccessToken(accessToken);
  if (nextRefreshToken) setRefreshToken(nextRefreshToken);
  notifyAuthContextUpdated();
  return accessToken;
}

export async function apiRequest<T>(
  route: string,
  options: RequestInit = {},
  isRetry = false
): Promise<{ data: T; ok: true } | { ok: false; error: string; status: number }> {
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}${route}`;
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const { res, data } = await doRequest<T>(url, headers, options);

    if (!res.ok) {
      if (res.status === 401 && route !== AUTH_ROUTES.REFRESH) {
        if (!isRetry) {
          const newToken = await tryRefresh();
          if (newToken) return apiRequest<T>(route, options, true);
          clearAuthToken();
          clearStoredUser();
        }
        // 401 after a successful refresh+retry: keep the session. The token is valid but this
        // route rejected the caller (e.g. Staff on an admin-only URL, or a stale in-flight
        // request from a previous user finishing after login).
      } else if (res.status === 401) {
        clearAuthToken();
        clearStoredUser();
      }
      const msg = (data as ApiError).message ?? (data as ApiError).error;
      return { ok: false, error: typeof msg === "string" ? msg : "Request failed.", status: res.status };
    }

    return { data: data as T, ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again.", status: 0 };
  }
}
