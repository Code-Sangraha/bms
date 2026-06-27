"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import horizontalLogo from "@/app/assets/horizontal-logo.png";

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
import {
  getStoredEmployeeId,
  getStoredOutletId,
  setStoredUser,
} from "@/lib/auth/user";
import { useI18n } from "@/app/providers/I18nProvider";
import { loginSchema, type LoginFormValues } from "@/schema/auth";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { FormField } from "@/app/components/ui-ext/FormField";

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
              "roleId" in user &&
              typeof user.roleId === "string" &&
              user.roleId.trim() !== ""
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
              "fullName" in user &&
              typeof user.fullName === "string" &&
              user.fullName.trim() !== ""
                ? user.fullName.trim()
                : undefined;
            const fromApiEmail =
              "email" in user &&
              typeof user.email === "string" &&
              user.email.trim() !== ""
                ? user.email.trim()
                : undefined;
            const responseData = result.data.data ?? result.data;
            const permissions = Array.isArray(responseData.permissions)
              ? responseData.permissions.filter(
                  (p): p is string => typeof p === "string",
                )
              : [];
            const loggedInIdentity = values.email.trim();
            setStoredUser({
              outletId: topOutletId ?? nestedId ?? null,
              outletName: nestedName ?? null,
              id:
                "id" in user && typeof user.id === "string"
                  ? user.id.trim() || null
                  : undefined,
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
          const roleName =
            normalizeRoleName(getRoleFromToken()) ??
            (getStoredEmployeeId() ? "Staff" : null);
          const outletId = getOutletIdFromToken() ?? getStoredOutletId();
          const accessTier = deriveAccessTier({
            roleName,
            userOutletId: outletId,
          });
          queryClient.cancelQueries();
          queryClient.clear();
          navigate(defaultPathForTier(accessTier, outletId), { replace: true });
        } else {
          setError("root", {
            message: t("No token received. Please try again."),
          });
        }
      } else {
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", {
        message: t("Something went wrong. Please try again."),
      });
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    mutation.mutate(data);
  };

  const loading = isSubmitting || mutation.isPending;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-2 pb-2 text-center">
          <div className="mx-auto flex aspect-video w-44 items-center justify-center rounded-2xl border border-border bg-background p-2 shadow-sm">
            <img
              src={horizontalLogo}
              alt="Highland Meat Processing"
              className="h-full w-full rounded-xl object-contain"
            />
          </div>
          <CardTitle className="text-xl">{t("Sign in")}</CardTitle>
          <CardDescription>
            {t("Enter your credentials to access Highland Meat Processing.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            {errors.root?.message ? (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              id="login-identifier"
              label={t("Email or Employee ID")}
              error={errors.email?.message}
            >
              <Input
                id="login-identifier"
                type="text"
                placeholder={t("e.g. you@example.com or staff ID")}
                autoComplete="username"
                aria-invalid={Boolean(errors.email)}
                {...registerField("email")}
              />
            </FormField>

            <FormField
              id="login-password"
              label={t("Password")}
              error={errors.password?.message}
            >
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("Enter your password")}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  className="pr-10"
                  {...registerField("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={
                    showPassword ? t("Hide password") : t("Show password")
                  }
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </FormField>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {loading ? t("Signing in…") : t("Sign in")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
