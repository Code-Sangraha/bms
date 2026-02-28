/**
 * Role-based permissions: Create, Read, Update, Delete.
 * Admin: all; Manager: no Delete; Staff: Create+Read only; Viewer: Read only.
 */

export type Permission = "create" | "read" | "update" | "delete";

export type RoleName = "Admin" | "Manager" | "Staff" | "Viewer";

export type Permissions = {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

const ROLE_MATRIX: Record<RoleName, Permissions> = {
  Admin: { create: true, read: true, update: true, delete: true },
  Manager: { create: true, read: true, update: true, delete: false },
  Staff: { create: true, read: true, update: false, delete: false },
  Viewer: { create: false, read: true, update: false, delete: false },
};

const DEFAULT_PERMISSIONS: Permissions = ROLE_MATRIX.Viewer;

/** Normalize role string from API/JWT (case-insensitive, trim). */
export function normalizeRoleName(role: string | null | undefined): RoleName | null {
  if (role == null || typeof role !== "string") return null;
  const r = role.trim();
  if (!r) return null;
  const lower = r.toLowerCase();
  if (lower === "admin") return "Admin";
  if (lower === "manager") return "Manager";
  if (lower === "staff") return "Staff";
  if (lower === "viewer") return "Viewer";
  return null;
}

/**
 * Get permissions for a role. Unknown roles default to Viewer (read-only).
 */
export function getPermissions(role: string | null | undefined): Permissions {
  const name = normalizeRoleName(role);
  if (name == null) return DEFAULT_PERMISSIONS;
  return ROLE_MATRIX[name] ?? DEFAULT_PERMISSIONS;
}
