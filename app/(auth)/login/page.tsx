"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useState } from "react";
import {
  getRefreshTokenFromAuthResponse,
  getTokenFromAuthResponse,
  getUserFromAuthResponse,
  login as loginApi,
} from "@/handlers/auth";
import { syncStoredOutletFromAccessToken } from "@/lib/auth/role";
import { setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { setStoredUser } from "@/lib/auth/user";
import { useI18n } from "@/app/providers/I18nProvider";
import { loginSchema, type LoginFormValues } from "@/schema/auth";
import "../auth.scss";

export default function LoginPage() {
  const navigate = useNavigate();
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
            const fromApiEmail =
              "email" in user && typeof user.email === "string" && user.email.trim() !== ""
                ? user.email.trim()
                : undefined;
            setStoredUser({
              outletId: topOutletId ?? nestedId,
              outletName: nestedName,
              id: "id" in user && typeof user.id === "string" ? user.id : undefined,
              email: fromApiEmail ?? values.email.trim(),
            });
          } else {
            setStoredUser({ email: values.email.trim() });
          }
          syncStoredOutletFromAccessToken(token);
          navigate("/dashboard");
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

        <form onSubmit={handleSubmit(onSubmit)} className="authForm">
          {errors.root?.message && <p className="authError">{errors.root.message}</p>}
          <label htmlFor="login-email" className="authField">
            <span className="authLabel">{t("Email")}</span>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              className="authInput"
              autoComplete="email"
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
              {loading ? t("Signing inâ€¦") : t("Sign in")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
