"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  getRefreshTokenFromAuthResponse,
  getTokenFromAuthResponse,
  getUserFromAuthResponse,
  login as loginApi,
} from "@/handlers/auth";
import { setAuthToken, setRefreshToken } from "@/lib/auth/token";
import { setStoredUser } from "@/lib/auth/user";
import { useI18n } from "@/app/providers/I18nProvider";
import { loginSchema, type LoginFormValues } from "@/schema/auth";
import "../auth.scss";

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
    onSuccess: (result) => {
      if (result.ok) {
        const token = getTokenFromAuthResponse(result.data);
        if (token) {
          setAuthToken(token);
          const refreshToken = getRefreshTokenFromAuthResponse(result.data);
          if (refreshToken) setRefreshToken(refreshToken);
          const user = getUserFromAuthResponse(result.data);
          if (user != null && typeof user === "object") {
            setStoredUser({ outletId: user.outletId ?? null });
          }
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
        <p className="authSubtitle">{t("Enter your credentials to access BMS.")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="authForm">
        {errors.root?.message && (
          <p className="authError">{errors.root.message}</p>
        )}
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
          {errors.email && (
            <span className="authFieldError">{errors.email.message}</span>
          )}
        </label>
        <label htmlFor="login-password" className="authField">
          <span className="authLabel">{t("Password")}</span>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            className="authInput"
            autoComplete="current-password"
            {...registerField("password")}
          />
          {errors.password && (
            <span className="authFieldError">{errors.password.message}</span>
          )}
        </label>
        <div className="authActions">
          <button
            type="submit"
            className="authButton authButtonPrimary"
            disabled={loading}
          >
            {loading ? t("Signing in…") : t("Sign in")}
          </button>
        </div>
      </form>

      <p className="authFooter">
        {t("Don't have an account?")}{" "}
        <Link to="/register" className="authLink">
          {t("Register")}
        </Link>
      </p>
    </div>
    </div>
  );
}
