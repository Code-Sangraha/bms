"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Permissions, RoleName } from "@/lib/auth/permissions";
import { getPermissions, normalizeRoleName } from "@/lib/auth/permissions";
import { getRoleFromToken } from "@/lib/auth/role";
import { getStoredOutletId } from "@/lib/auth/user";

type AuthContextValue = {
  roleName: RoleName | null;
  /** When set (e.g. Manager/Staff), user is restricted to this outlet. */
  userOutletId: string | null;
  permissions: Permissions;
  refreshRole: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleName, setRoleName] = useState<RoleName | null>(null);
  const [userOutletId, setUserOutletId] = useState<string | null>(null);

  const refreshRole = useCallback(() => {
    const role = getRoleFromToken();
    setRoleName(normalizeRoleName(role));
    setUserOutletId(getStoredOutletId());
  }, []);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  const permissions = useMemo(
    () => getPermissions(roleName ?? getRoleFromToken()),
    [roleName]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      roleName,
      userOutletId,
      permissions,
      refreshRole,
    }),
    [roleName, userOutletId, permissions, refreshRole]
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
} {
  const { permissions, roleName } = useAuth();
  return {
    ...permissions,
    canCreate: permissions.create,
    canRead: permissions.read,
    canUpdate: permissions.update,
    canDelete: permissions.delete,
    roleName,
  };
}
