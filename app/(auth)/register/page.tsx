"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { getTokenFromAuthResponse, register as registerApi } from "@/handlers/auth";
import { setAuthToken } from "@/lib/auth/token";
import { registerSchema, type RegisterFormValues } from "@/schema/auth";

export default function RegisterPage() {
  const router = useRouter();
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      userName: "",
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: RegisterFormValues) =>
      registerApi({
        email: values.email,
        userName: values.userName,
        fullName: values.fullName,
        password: values.password,
        confirmPassword: values.confirmPassword,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        const token = getTokenFromAuthResponse(result.data);
        if (token) {
          setAuthToken(token);
          router.push("/dashboard");
        } else {
          router.push("/login");
        }
      } else {
        setError("root", { message: result.error });
      }
    },
    onError: () => {
      setError("root", { message: "Something went wrong. Please try again." });
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    mutation.mutate(data);
  };

  const loading = mutation.isPending;
  const errorMessage = errors.root?.message;

  return (
    <div className="authCard">
      <div className="authHeader">
        <h1 className="authTitle">Create account</h1>
        <p className="authSubtitle">Register to get started with BMS.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="authForm">
        {errorMessage && <p className="authError">{errorMessage}</p>}
        <label htmlFor="register-username" className="authField">
          <span className="authLabel">User name</span>
          <input
            id="register-username"
            type="text"
            placeholder="e.g. John"
            className="authInput"
            autoComplete="username"
            {...registerField("userName")}
          />
          {errors.userName && (
            <span className="authFieldError">{errors.userName.message}</span>
          )}
        </label>
        <label htmlFor="register-fullname" className="authField">
          <span className="authLabel">Full name</span>
          <input
            id="register-fullname"
            type="text"
            placeholder="e.g. John Doe"
            className="authInput"
            autoComplete="name"
            {...registerField("fullName")}
          />
          {errors.fullName && (
            <span className="authFieldError">{errors.fullName.message}</span>
          )}
        </label>
        <label htmlFor="register-email" className="authField">
          <span className="authLabel">Email</span>
          <input
            id="register-email"
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
        <label htmlFor="register-password" className="authField">
          <span className="authLabel">Password</span>
          <input
            id="register-password"
            type="password"
            placeholder="••••••••"
            className="authInput"
            autoComplete="new-password"
            {...registerField("password")}
          />
          {errors.password && (
            <span className="authFieldError">{errors.password.message}</span>
          )}
        </label>
        <label htmlFor="register-confirm" className="authField">
          <span className="authLabel">Confirm password</span>
          <input
            id="register-confirm"
            type="password"
            placeholder="••••••••"
            className="authInput"
            autoComplete="new-password"
            {...registerField("confirmPassword")}
          />
          {errors.confirmPassword && (
            <span className="authFieldError">
              {errors.confirmPassword.message}
            </span>
          )}
        </label>
        <div className="authActions">
          <button
            type="submit"
            className="authButton authButtonPrimary"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>

      <p className="authFooter">
        Already have an account?{" "}
        <Link href="/login" className="authLink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
