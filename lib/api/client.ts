import { clearAuthToken, getAuthToken } from "@/lib/auth/token";
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

export async function apiRequest<T>(
  route: string,
  options: RequestInit = {}
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
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({})) as T & ApiError;

    if (!res.ok) {
      if (res.status === 401) {
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
