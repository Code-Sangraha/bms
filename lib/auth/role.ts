import { getAuthToken } from "@/lib/auth/token";

/**
 * Decode JWT payload without verification (client-side; API verifies).
 * Backend should include the user's role in the token, e.g.:
 * payload.role ("Admin" | "Manager" | "Staff" | "Viewer"),
 * payload.roleName, or payload.roles[0].
 * If missing, user is treated as Viewer (read-only).
 */
export function getRoleFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getAuthToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as Record<string, unknown>;
    const role = decoded.role ?? decoded.roleName;
    if (typeof role === "string") return role;
    if (Array.isArray(decoded.roles) && decoded.roles.length > 0 && typeof decoded.roles[0] === "string")
      return decoded.roles[0];
    return null;
  } catch {
    return null;
  }
}
