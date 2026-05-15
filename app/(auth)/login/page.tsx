"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useState } from "react";
import {
  getRefreshTokenFromAuthResponse,
  getTokenFromAuthResponse,
  getUserFromAuthResponse,
  login as loginApi,
} from "@/handlers/auth";
import {
  getOutletIdFromToken,
  getRoleFromToken,
  syncStoredOutletFromAccessToken,
} from "@/lib/auth/role";
import { defaultPathForTier, deriveAccessTier } from "@/lib/auth/accessTier";
import { normalizeRoleName } from "@/lib/auth/permissions";
import { setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { getStoredEmployeeId, getStoredOutletId, setStoredUser } from "@/lib/auth/user";
import { useI18n } from "@/app/providers/I18nProvider";
import { loginSchema, type LoginFormValues } from "@/schema/auth";
import "../auth.scss";

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      loginApi({ email: values.email, password: values.password }),
    onSuccess: (result, values) => {
      if (result.ok) {
        const token = getTokenFromAuthResponse(result.data);
        if (token) {
          setAuthToken(token);
          const refreshToken = getRefreshTokenFromAuthResponse(result.data);
          if (refreshToken) setRefreshToken(refreshToken);
          const user = getUserFromAuthResponse(result.data);
          if (user != null && typeof user === "object") {
            const outlet = "outlet" in user ? user.outlet : null;
            const role = "role" in user ? user.role : null;
            const nestedId =
              outlet != null &&
              typeof outlet === "object" &&
              outlet !== null &&
              "id" in outlet &&
              typeof (outlet as { id?: unknown }).id === "string"
                ? (outlet as { id: string }).id.trim() || null
                : null;
            const nestedName =
              outlet != null &&
              typeof outlet === "object" &&
              outlet !== null &&
              "name" in outlet &&
              typeof (outlet as { name?: unknown }).name === "string"
                ? (outlet as { name: string }).name.trim() || null
                : null;
            const topOutletId =
              "outletId" in user &&
              typeof user.outletId === "string" &&
              user.outletId.trim() !== ""
                ? user.outletId.trim()
                : null;
            const roleId =
              "roleId" in user && typeof user.roleId === "string" && user.roleId.trim() !== ""
                ? user.roleId.trim()
                : null;
            const roleName =
              role != null &&
              typeof role === "object" &&
              "name" in role &&
              typeof (role as { name?: unknown }).name === "string" &&
              (role as { name: string }).name.trim() !== ""
                ? (role as { name: string }).name.trim()
                : null;
            const apiEmployeeId =
              "employeeId" in user &&
              typeof (user as { employeeId?: unknown }).employeeId === "string" &&
              (user as { employeeId: string }).employeeId.trim() !== ""
                ? (user as { employeeId: string }).employeeId.trim()
                : undefined;
            const apiEmployeeName =
              "name" in user && typeof (user as { name?: unknown }).name === "string"
                ? (user as { name: string }).name.trim()
                : undefined;
            const apiUserFullName =
              "fullName" in user && typeof user.fullName === "string" && user.fullName.trim() !== ""
                ? user.fullName.trim()
                : undefined;
            const fromApiEmail =
              "email" in user && typeof user.email === "string" && user.email.trim() !== ""
                ? user.email.trim()
                : undefined;
            const responseData = result.data.data ?? result.data;
            const permissions = Array.isArray(responseData.permissions)
              ? responseData.permissions.filter((p): p is string => typeof p === "string")
              : [];
            const loggedInIdentity = values.email.trim();
            setStoredUser({
              outletId: topOutletId ?? nestedId ?? null,
              outletName: nestedName ?? null,
              id: "id" in user && typeof user.id === "string" ? user.id.trim() || null : undefined,
              roleId,
              roleName,
              permissions,
              email: fromApiEmail ?? apiEmployeeId ?? loggedInIdentity,
              employeeId: apiEmployeeId ?? null,
              fullName: apiUserFullName ?? apiEmployeeName ?? undefined,
            });
          } else {
            setStoredUser({ email: values.email.trim() });
          }
          syncStoredOutletFromAccessToken(token);
          const roleName = normalizeRoleName(getRoleFromToken()) ?? (getStoredEmployeeId() ? "Staff" : null);
          const outletId = getOutletIdFromToken() ?? getStoredOutletId();
          const accessTier = deriveAccessTier({ roleName, userOutletId: outletId });
          queryClient.cancelQueries();
          queryClient.clear();
          navigate(defaultPathForTier(accessTier, outletId), { replace: true });
        } else {
          setError("root", { message: t("No token received. Please try again.") });
        }
      } else {
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: t("Something went wrong. Please try again.") });
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    mutation.mutate(data);
  };

  const loading = isSubmitting || mutation.isPending;

  return (
    <div className="authLayout">
      <div className="authCard">
        <div className="authHeader">
          <h1 className="authTitle">{t("Sign in")}</h1>
          <p className="authSubtitle">
            {t("Enter your credentials to access Highland Meat Processing.")}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="authForm" noValidate>
          {errors.root?.message && <p className="authError">{errors.root.message}</p>}
          <label htmlFor="login-identifier" className="authField">
            <span className="authLabel">{t("Email or Employee ID")}</span>
            <input
              id="login-identifier"
              type="text"
              placeholder={t("e.g. you@example.com or staff ID")}
              className="authInput"
              autoComplete="username"
              {...registerField("email")}
            />
            {errors.email && <span className="authFieldError">{errors.email.message}</span>}
          </label>
          <label htmlFor="login-password" className="authField">
            <span className="authLabel">{t("Password")}</span>
            <div className="authPasswordWrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder={t("Enter your password")}
                className="authInput authInputPassword"
                autoComplete="current-password"
                {...registerField("password")}
              />
              <button
                type="button"
                className="authPasswordToggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t("Hide password") : t("Show password")}
              >
                {showPassword ? t("Hide") : t("Show")}
              </button>
            </div>
            {errors.password && <span className="authFieldError">{errors.password.message}</span>}
          </label>
          <div className="authActions">
            <button type="submit" className="authButton authButtonPrimary" disabled={loading}>
              {loading ? t("Signing in…") : t("Sign in")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
