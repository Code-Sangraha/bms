import { AUTH_ROUTES } from "@/lib/api/routes";
import { clearAuthToken, getAuthToken, getRefreshToken, setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
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
async function tryRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  if (!baseUrl) return null;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${baseUrl}${AUTH_ROUTES.REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { accessToken?: string; refreshToken?: string };
  };
  if (!res.ok || !data.data?.accessToken) return null;
  setAuthToken(data.data.accessToken);
  if (data.data.refreshToken) setRefreshToken(data.data.refreshToken);
  return data.data.accessToken;
}

export async function apiRequest<T>(
  route: string,
  options: RequestInit = {},
  isRetry = false
): Promise<{ data: T; ok: true } | { ok: false; error: string; status: number }> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { ok: false, error: "API URL is not configured.", status: 0 };
  }

  const url = `${baseUrl.replace(/\/$/, "")}${route}`;
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const { res, data } = await doRequest<T>(url, headers, options);

    if (!res.ok) {
      if (res.status === 401 && !isRetry && route !== AUTH_ROUTES.REFRESH) {
        const newToken = await tryRefresh();
        if (newToken) return apiRequest<T>(route, options, true);
        clearAuthToken();
        clearStoredUser();
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
