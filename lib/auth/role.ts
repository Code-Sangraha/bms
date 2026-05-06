import { decodeJwtPayload } from "@/lib/auth/jwtPayload";
import { getAuthToken } from "@/lib/auth/token";
import { getStoredUser, setStoredUser } from "@/lib/auth/user";

/**
 * Read JWT payload without verification (client-side; API verifies).
 * Backend sends `role` (string); optional `roleName` / `roles[0]` for compatibility.
 */
export function getRoleFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;
  const role = decoded.role ?? decoded.roleName;
  if (typeof role === "string") return role;
  if (Array.isArray(decoded.roles) && decoded.roles.length > 0 && typeof decoded.roles[0] === "string")
    return decoded.roles[0];
  return null;
}

/** Auth user id from access token (`userId` claim). */
export function getUserIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;
  const v = decoded.userId;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

/** Outlet id claim from access token (`outletId`), if present. */
export function getOutletIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;
  const v = decoded.outletId;
  if (v === null) return null;
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

/**
 * Fine-grained permission names from JWT (e.g. `user:create`).
 * UI still uses coarse role matrix by default; use for extra checks where needed.
 */
export function getJwtPermissionNamesFromToken(): string[] {
  if (typeof window === "undefined") return [];
  const token = getAuthToken();
  if (!token) return [];
  const decoded = decodeJwtPayload(token);
  if (!decoded) return [];
  const raw = decoded.permissions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string" && p.trim() !== "");
}

/**
 * After a new access token is stored (e.g. refresh), sync `outletId` in localStorage
 * from JWT so it matches DB without re-login. Keeps other stored user fields.
 */
export function syncStoredOutletFromAccessToken(accessToken: string): void {
  const decoded = decodeJwtPayload(accessToken);
  if (!decoded || !("outletId" in decoded)) return;
  const v = decoded.outletId;
  const outletId =
    v === null || v === undefined
      ? null
      : typeof v === "string" && v.trim() !== ""
        ? v.trim()
        : null;
  const existing = getStoredUser() ?? {};
  setStoredUser({ ...existing, outletId });
}
