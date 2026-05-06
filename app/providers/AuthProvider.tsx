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
import type { Permissions, RoleName } from "@/lib/auth/permissions";
import { getPermissions, normalizeRoleName } from "@/lib/auth/permissions";
import { getJwtPermissionNamesFromToken, getRoleFromToken } from "@/lib/auth/role";
import { getStoredOutletId, getStoredOutletName } from "@/lib/auth/user";

type AuthContextValue = {
  roleName: RoleName | null;
  /** When set (e.g. Manager/Staff), user is restricted to this outlet. */
  userOutletId: string | null;
  /** From login response `user.outlet.name` when available. */
  userOutletName: string | null;
  /** Backend JWT `permissions` strings (e.g. `user:create`), if any. */
  jwtPermissionNames: string[];
  /** Fine-grained check against JWT permission names. */
  hasJwtPermission: (name: string) => boolean;
  permissions: Permissions;
  refreshRole: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleName, setRoleName] = useState<RoleName | null>(null);
  const [userOutletId, setUserOutletId] = useState<string | null>(null);
  const [userOutletName, setUserOutletName] = useState<string | null>(null);
  const [jwtPermissionNames, setJwtPermissionNames] = useState<string[]>([]);

  const refreshRole = useCallback(() => {
    const role = getRoleFromToken();
    setRoleName(normalizeRoleName(role));
    setUserOutletId(getStoredOutletId());
    setUserOutletName(getStoredOutletName());
    setJwtPermissionNames(getJwtPermissionNamesFromToken());
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
      userOutletId,
      userOutletName,
      jwtPermissionNames,
      hasJwtPermission,
      permissions,
      refreshRole,
    }),
    [roleName, userOutletId, userOutletName, jwtPermissionNames, hasJwtPermission, permissions, refreshRole]
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
      userOutletId: null,
      userOutletName: null,
      jwtPermissionNames: [],
      hasJwtPermission: () => false,
      permissions: getPermissions(null),
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
  userOutletName: string | null;
  jwtPermissionNames: string[];
  hasJwtPermission: (name: string) => boolean;
} {
  const { permissions, roleName, userOutletName, jwtPermissionNames, hasJwtPermission } = useAuth();
  return {
    ...permissions,
    canCreate: permissions.create,
    canRead: permissions.read,
    canUpdate: permissions.update,
    canDelete: permissions.delete,
    roleName,
    userOutletName,
    jwtPermissionNames,
    hasJwtPermission,
  };
}
