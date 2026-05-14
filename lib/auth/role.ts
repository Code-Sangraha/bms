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

/** Coerce JWT claim values that represent a user/employee row id (string or numeric). */
function coerceSubjectIdFromClaim(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Distinct subject ids from the access token, in typical precedence order.
 * Clock/employee matching may try each until one equals `Employee.id` on the server.
 */
export function getCandidateUserIdsFromToken(): string[] {
  if (typeof window === "undefined") return [];
  const token = getAuthToken();
  if (!token) return [];
  const decoded = decodeJwtPayload(token);
  if (!decoded) return [];
  const keys = ["userId", "sub", "user_id", "id"] as const;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const s = coerceSubjectIdFromClaim(decoded[key]);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Primary subject id for auth context (first token claim in {@link getCandidateUserIdsFromToken} order). */
export function getUserIdFromToken(): string | null {
  const list = getCandidateUserIdsFromToken();
  return list[0] ?? null;
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
