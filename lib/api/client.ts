import { AUTH_ROUTES } from "@/lib/api/routes";
import {
  AUTH_SESSION_CHANGED_MESSAGE,
  notifyAuthContextUpdated,
  notifyAuthSessionExpired,
} from "@/lib/auth/authEvents";
import { syncStoredOutletFromAccessToken } from "@/lib/auth/role";
import { clearAuthToken, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";
import type { ApiValidationError } from "@/lib/api/types";

export const getBaseUrl = (): string => {
  const configuredBaseUrl = (import.meta.env.VITE_API_URL ?? "").trim();
  if (!configuredBaseUrl) return "";
  // Express mounts `/v1` (lowercase). Normalize a trailing `/V1` from env so requests hit registered routes.
  return configuredBaseUrl.replace(/\/$/, "").replace(/\/V1$/i, "/v1");
};

export type ApiError = {
  message?: string;
  error?: string | ApiValidationError[];
};

export function getApiErrorMessage(data: unknown, fallback = "Request failed."): string {
  if (!data || typeof data !== "object") return fallback;
  const payload = data as ApiError;
  if (Array.isArray(payload.error)) {
    const messages = payload.error
      .map((entry) => {
        const message = typeof entry?.message === "string" ? entry.message.trim() : "";
        const path = typeof entry?.path === "string" ? entry.path.trim() : "";
        if (!message) return "";
        return path ? `${path}: ${message}` : message;
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join("\n");
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallback;
}

export function isTokenVersionInvalid(data: unknown): boolean {
  return getApiErrorMessage(data, "") === "Token expired";
}

export function expireAuthSession(message = AUTH_SESSION_CHANGED_MESSAGE): void {
  clearAuthToken();
  clearStoredUser();
  notifyAuthContextUpdated();
  notifyAuthSessionExpired(message);
}

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

export async function retryAfterUnauthorized<
  TResponse extends { status: number; data: unknown },
>(
  response: TResponse,
  retry: (token: string) => Promise<TResponse>
): Promise<TResponse> {
  if (response.status !== 401) return response;
  if (isTokenVersionInvalid(response.data)) {
    expireAuthSession();
    return response;
  }
  const token = await tryRefresh();
  if (!token) {
    expireAuthSession();
    return response;
  }
  const retried = await retry(token);
  if (retried.status === 401) expireAuthSession();
  return retried;
}
export async function apiRequest<T>(
  route: string,
  options: RequestInit = {},
  isRetry = false
): Promise<{ data: T; ok: true } | { ok: false; error: string; status: number }> {
  const baseUrl = getBaseUrl();

  const url = `${baseUrl}${route}`;
  const token = getAuthToken();
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody = options.body != null && options.body !== "";
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(hasBody || method === "POST" || method === "PUT" || method === "PATCH"
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  try {
    const { res, data } = await doRequest<T>(url, headers, options);

    if (!res.ok) {
      if (res.status === 401 && route !== AUTH_ROUTES.REFRESH) {
        if (isTokenVersionInvalid(data)) {
          expireAuthSession();
        } else if (!isRetry) {
          const newToken = await tryRefresh();
          if (newToken) return apiRequest<T>(route, options, true);
          expireAuthSession();
        } else {
          // A retried request must never enter another refresh loop.
          expireAuthSession();
        }
      } else if (res.status === 401) {
        expireAuthSession();
      }
      return {
        ok: false,
        error: getApiErrorMessage(data),
        status: res.status,
      };
    }

    return { data: data as T, ok: true };
  } catch (err) {
    const isNetwork =
      err instanceof TypeError ||
      (err instanceof Error && /fetch|network|cors/i.test(err.message));
    return {
      ok: false,
      error: isNetwork
        ? "Network error — check API URL, CORS, or VPN. If testing locally, use the Vite proxy or deploy the frontend on an allowed origin."
        : "Something went wrong. Please try again.",
      status: 0,
    };
  }
}
