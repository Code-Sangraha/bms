import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, getApiErrorMessage, tryRefresh } from "./client";
import { getStoredRoleId, setStoredUser } from "@/lib/auth/user";
import { setAuthToken, setRefreshToken } from "@/lib/auth/token";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("API client authentication", () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubEnv("VITE_API_URL", "https://api.test/v1");
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("CustomEvent", class<T> extends Event { detail: T; constructor(type: string, init?: { detail?: T }) { super(type); this.detail = init?.detail as T; } });
    vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() });
    setAuthToken("access-old");
    setRefreshToken("refresh-old");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("formats validation error arrays before falling back to message", () => {
    expect(getApiErrorMessage({ success: false, message: "Invalid", error: [{ path: "name", message: "Required" }, { path: "quantity", message: "Must be positive" }] })).toBe("name: Required\nquantity: Must be positive");
  });

  it("does not refresh an exact Token expired response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: false, message: "Token expired" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("/secure")).resolves.toMatchObject({ ok: false, status: 401, error: "Token expired" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.getItem("bms_auth_token")).toBeNull();
  });

  it("refreshes once for Invalid token and retries the request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: false, message: "Invalid token" }, 401))
      .mockResolvedValueOnce(json({ success: true, data: { accessToken: "access-new" } }, 200))
      .mockResolvedValueOnce(json({ success: true, data: { value: 7 } }, 200));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest<{ success: boolean; data: { value: number } }>("/secure")).resolves.toMatchObject({ ok: true, data: { data: { value: 7 } } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(storage.getItem("bms_auth_token")).toBe("access-new");
  });

  it("clears the session when the retried request is still unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ message: "Invalid token" }, 401))
      .mockResolvedValueOnce(json({ data: { accessToken: "access-new" } }, 200))
      .mockResolvedValueOnce(json({ message: "Invalid token" }, 401)));
    await apiRequest("/secure");
    expect(storage.getItem("bms_auth_token")).toBeNull();
    expect(storage.getItem("bms_refresh_token")).toBeNull();
  });

  it("preserves the persisted role id through access-token refresh", async () => {
    setStoredUser({ id: "user-1", roleId: "role-admin" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ data: { accessToken: "access-new" } }, 200)));
    await tryRefresh();
    expect(getStoredRoleId()).toBe("role-admin");
  });

  it("keeps the session on forbidden responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "Forbidden" }, 403)));
    await apiRequest("/secure");
    expect(storage.getItem("bms_auth_token")).toBe("access-old");
  });
});