"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_CONTEXT_UPDATED_EVENT } from "@/lib/auth/authEvents";
import type { RoleCapabilities } from "@/lib/auth/capabilities";
import { getRoleCapabilities } from "@/lib/auth/capabilities";
import type { Permissions, RoleName } from "@/lib/auth/permissions";
import { getPermissions, normalizeRoleName } from "@/lib/auth/permissions";
import {
  getJwtPermissionNamesFromToken,
  getOutletIdFromToken,
  getRoleFromToken,
  getUserIdFromToken,
} from "@/lib/auth/role";
import {
  getStoredEmployeeId,
  getStoredOutletId,
  getStoredOutletName,
  getStoredRoleId,
  getStoredUser,
  setStoredUser,
} from "@/lib/auth/user";

type AuthContextValue = {
  roleName: RoleName | null;
  roleId: string | null;
  isAuthReady: boolean;
  /** JWT `userId` (trimmed); stable for memo deps when token hydrates after employees load. */
  authUserId: string | null;
  /** When set (e.g. Manager/Staff), user is restricted to this outlet. */
  userOutletId: string | null;
  /** From login response `user.outlet.name` when available. */
  userOutletName: string | null;
  /** Backend JWT `permissions` strings (e.g. `user:create`), if any. */
  jwtPermissionNames: string[];
  /** Fine-grained check against JWT permission names. */
  hasJwtPermission: (name: string) => boolean;
  permissions: Permissions;
  capabilities: RoleCapabilities;
  refreshRole: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleName, setRoleName] = useState<RoleName | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userOutletId, setUserOutletId] = useState<string | null>(null);
  const [userOutletName, setUserOutletName] = useState<string | null>(null);
  const [jwtPermissionNames, setJwtPermissionNames] = useState<string[]>([]);

  const refreshRole = useCallback(() => {
    const role = getRoleFromToken();
    setAuthUserId(getUserIdFromToken());
    const tokenOutletId = getOutletIdFromToken();
    const fallbackOutletId = getStoredOutletId();
    const resolvedOutletId = tokenOutletId ?? fallbackOutletId;

    // Keep storage aligned with token claims (canonical source) on boot/refresh.
    if (resolvedOutletId && resolvedOutletId !== fallbackOutletId) {
      const existing = getStoredUser() ?? {};
      setStoredUser({ ...existing, outletId: resolvedOutletId });
    }

    setRoleName(normalizeRoleName(role) ?? (getStoredEmployeeId() ? "Staff" : null));
    setRoleId(getStoredRoleId());
    setUserOutletId(resolvedOutletId);
    setUserOutletName(getStoredOutletName());
    setJwtPermissionNames(getJwtPermissionNamesFromToken());
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  useEffect(() => {
    const onUpdate = () => refreshRole();
    window.addEventListener(AUTH_CONTEXT_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(AUTH_CONTEXT_UPDATED_EVENT, onUpdate);
  }, [refreshRole]);

  const permissions = useMemo(
    () => getPermissions(roleName ?? getRoleFromToken()),
    [roleName]
  );
  const capabilities = useMemo(() => getRoleCapabilities(roleName), [roleName]);

  const hasJwtPermission = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return false;
      return jwtPermissionNames.includes(n);
    },
    [jwtPermissionNames]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      roleName,
      roleId,
      isAuthReady,
      authUserId,
      userOutletId,
      userOutletName,
      jwtPermissionNames,
      hasJwtPermission,
      permissions,
      capabilities,
      refreshRole,
    }),
    [
      roleName,
      roleId,
      isAuthReady,
      authUserId,
      userOutletId,
      userOutletName,
      jwtPermissionNames,
      hasJwtPermission,
      permissions,
      capabilities,
      refreshRole,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    return {
      roleName: null,
      roleId: null,
      isAuthReady: false,
      authUserId: null,
      userOutletId: null,
      userOutletName: null,
      jwtPermissionNames: [],
      hasJwtPermission: () => false,
      permissions: getPermissions(null),
      capabilities: getRoleCapabilities(null),
      refreshRole: () => {},
    };
  }
  return ctx;
}

/** Convenience hook for permission checks in UI. */
export function usePermissions(): Permissions & {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  roleName: RoleName | null;
  roleId: string | null;
  isAuthReady: boolean;
  userOutletName: string | null;
  jwtPermissionNames: string[];
  hasJwtPermission: (name: string) => boolean;
  capabilities: RoleCapabilities;
} {
const {
    permissions,
    roleName,
    roleId,
    isAuthReady,
    userOutletName,
    jwtPermissionNames,
    hasJwtPermission,
    capabilities,
  } = useAuth();
  return {
    ...permissions,
    canCreate: permissions.create,
    canRead: permissions.read,
    canUpdate: permissions.update,
    canDelete: permissions.delete,
    roleName,
    roleId,
    isAuthReady,
    userOutletName,
    jwtPermissionNames,
    hasJwtPermission,
    capabilities,
  };
}
