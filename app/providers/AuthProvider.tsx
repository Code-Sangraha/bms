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
import { getAuthAccess, type AuthAccessResponse } from "@/handlers/auth";
import { getAuthToken } from "@/lib/auth/token";
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
  accountType: AuthAccessResponse["accountType"] | null;
  accessError: string | null;
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
  accessScope: "global" | "outlet";
  isAdmin: boolean;
  accessPermissions: string[];
  refreshRole: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleName, setRoleName] = useState<RoleName | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isAccessReady, setIsAccessReady] = useState(false);
  const [accessRefreshKey, setAccessRefreshKey] = useState(0);
  const [accountType, setAccountType] =
    useState<AuthAccessResponse["accountType"] | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userOutletId, setUserOutletId] = useState<string | null>(null);
  const [userOutletName, setUserOutletName] = useState<string | null>(null);
  const [jwtPermissionNames, setJwtPermissionNames] = useState<string[]>([]);
  const [accessPermissions, setAccessPermissions] = useState<string[]>([]);
  const [accessScope, setAccessScope] = useState<"global" | "outlet">("outlet");
  const [isAdmin, setIsAdmin] = useState(false);
  const isAuthReady = isSessionReady && isAccessReady;

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
    setAccountType(null);
    setAccessPermissions([]);
    setAccessScope("outlet");
    setIsAdmin(false);
    setAccessError(null);
    setIsSessionReady(true);

    if (getAuthToken()) {
      setIsAccessReady(false);
      setAccessRefreshKey((key) => key + 1);
    } else {
      setIsAccessReady(true);
    }
  }, []);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  useEffect(() => {
    if (!isSessionReady || !getAuthToken()) return;
    let cancelled = false;
    getAuthAccess().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setAccessError(result.error);
        setIsAccessReady(true);
        return;
      }
      const access: AuthAccessResponse = result.data;
      setRoleName((current) => normalizeRoleName(access.role.name) ?? current);
      setRoleId(access.role.id);
      setAuthUserId(access.userId);
      setAccountType(access.accountType);
      setUserOutletId(access.outletId);
      setAccessPermissions(access.permissions);
      setAccessScope(access.accessScope);
      setIsAdmin(access.role.isAdmin);
      setAccessError(null);
      setIsAccessReady(true);
    });
    return () => { cancelled = true; };
  }, [accessRefreshKey, isSessionReady]);
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
      return accessPermissions.includes(n) || jwtPermissionNames.includes(n) || isAdmin;
    },
    [accessPermissions, isAdmin, jwtPermissionNames]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      roleName,
      roleId,
      isAuthReady,
      authUserId,
      accountType,
      accessError,
      userOutletId,
      userOutletName,
      jwtPermissionNames,
      accessPermissions,
      accessScope,
      isAdmin,
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
      accountType,
      accessError,
      userOutletId,
      userOutletName,
      jwtPermissionNames,
      accessPermissions,
      accessScope,
      isAdmin,
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
      accountType: null,
      accessError: null,
      authUserId: null,
      userOutletId: null,
      userOutletName: null,
      jwtPermissionNames: [],
      accessPermissions: [],
      accessScope: "outlet",
      isAdmin: false,
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
