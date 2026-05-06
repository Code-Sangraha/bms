/**
 * Decode JWT payload (middle segment) without verification.
 * Server must validate; client uses claims for UI only.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    return JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}
