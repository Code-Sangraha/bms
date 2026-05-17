/**
 * Role-based permissions: Create, Read, Update, Delete.
 * Admin: all; Manager: no Delete; Staff/Viewer: Read only.
 */

export type Permission = "create" | "read" | "update" | "delete";

export type RoleName = "Admin" | "Manager" | "Staff" | "Driver" | "Viewer";

export type Permissions = {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

const ROLE_MATRIX: Record<RoleName, Permissions> = {
  Admin: { create: true, read: true, update: true, delete: true },
  Manager: { create: false, read: true, update: false, delete: false },
  Staff: { create: false, read: true, update: false, delete: false },
  Driver: { create: false, read: true, update: false, delete: false },
  Viewer: { create: false, read: true, update: false, delete: false },
};

const DEFAULT_PERMISSIONS: Permissions = ROLE_MATRIX.Viewer;

/**
 * Stable key for matching backend `Roles.name` (any casing, spaces, _ or -).
 * Examples: "Superadmin" → "superadmin", "Outlet Manager" → "outlet manager"
 */
export function normalizeRoleKey(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Backend uses free-form role names; map to UI buckets. Extend as new names appear.
 * Unknown names still fall back to Viewer (read-only).
 */
const ROLE_NAME_ALIASES: Record<string, RoleName> = {
  admin: "Admin",
  administrator: "Admin",
  superadmin: "Admin",
  "super admin": "Admin",
  "system admin": "Admin",
  sysadmin: "Admin",
  root: "Admin",
  owner: "Admin",
  manager: "Manager",
  "outlet manager": "Manager",
  "branch manager": "Manager",
  "assistant manager": "Manager",
  supervisor: "Manager",
  lead: "Manager",
  staff: "Staff",
  employee: "Staff",
  associate: "Staff",
  cashier: "Staff",
  "outlet staff": "Staff",
  operator: "Staff",
  specialist: "Staff",
  driver: "Driver",
  delivery: "Driver",
  "delivery driver": "Driver",
  viewer: "Viewer",
  readonly: "Viewer",
  "read only": "Viewer",
  guest: "Viewer",
  auditor: "Viewer",
  /** Backend JWT default when role name missing — conservative. */
  user: "Viewer",
};

/** Normalize role string from API/JWT (case-insensitive, trim, alias map). */
export function normalizeRoleName(role: string | null | undefined): RoleName | null {
  if (role == null || typeof role !== "string") return null;
  const r = role.trim();
  if (!r) return null;
  const key = normalizeRoleKey(r);
  const fromAlias = ROLE_NAME_ALIASES[key];
  if (fromAlias != null) return fromAlias;
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
