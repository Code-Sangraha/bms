/**
 * Stored user info from login response (e.g. outletId for Manager/Staff).
 * Used to restrict UI (e.g. outlet dropdown) to the user's assigned outlet.
 */

const STORED_USER_KEY = "bms_stored_user";

export type StoredUser = {
  /** Auth user id from login response when present. */
  id?: string | null;
  email?: string | null;
  /** Employee business id when logged in as staff with employee profile. */
  employeeId?: string | null;
  /** Display name from Employee `name` or similar when present. */
  fullName?: string | null;
  outletId?: string | null;
  /** From login `user.outlet.name`; not present in JWT — refresh does not clear it. */
  outletName?: string | null;
  [key: string]: unknown;
};

function parseStored(raw: string | null): StoredUser | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (data != null && typeof data === "object") return data as StoredUser;
  } catch {
    // ignore
  }
  return null;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  return parseStored(localStorage.getItem(STORED_USER_KEY));
}

export function setStoredUser(user: StoredUser | null): void {
  if (typeof window === "undefined") return;
  if (user == null) {
    localStorage.removeItem(STORED_USER_KEY);
    return;
  }
  localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORED_USER_KEY);
}

/** Current user's outlet ID if they are restricted to one (e.g. Manager/Staff). */
export function getStoredOutletId(): string | null {
  const user = getStoredUser();
  const id = user?.outletId;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

/** Employee business/login ID from the last employee-shaped login response. */
export function getStoredEmployeeId(): string | null {
  const user = getStoredUser();
  const id = user?.employeeId;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

/** Outlet display name from last login, if returned by API. */
export function getStoredOutletName(): string | null {
  const user = getStoredUser();
  const n = user?.outletName;
  return typeof n === "string" && n.trim() !== "" ? n.trim() : null;
}
