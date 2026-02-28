"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { getTokenFromAuthResponse, getUserFromAuthResponse, login as loginApi } from "@/handlers/auth";
import { setAuthToken } from "@/lib/auth/token";
import { setStoredUser } from "@/lib/auth/user";
import { loginSchema, type LoginFormValues } from "@/schema/auth";

export default function LoginPage() {
  const router = useRouter();
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
          const user = getUserFromAuthResponse(result.data);
          if (user != null && typeof user === "object") {
            setStoredUser({ outletId: user.outletId ?? null });
          }
          router.push("/dashboard");
        } else {
          setError("root", { message: "No token received. Please try again." });
        }
      } else {
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: "Something went wrong. Please try again." });
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    mutation.mutate(data);
  };

  const loading = isSubmitting || mutation.isPending;

  return (
    <div className="authCard">
      <div className="authHeader">
        <h1 className="authTitle">Sign in</h1>
        <p className="authSubtitle">Enter your credentials to access BMS.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="authForm">
        {errors.root?.message && (
          <p className="authError">{errors.root.message}</p>
        )}
        <label htmlFor="login-email" className="authField">
          <span className="authLabel">Email</span>
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
          <span className="authLabel">Password</span>
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>

      <p className="authFooter">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="authLink">
          Register
        </Link>
      </p>
    </div>
  );
}
