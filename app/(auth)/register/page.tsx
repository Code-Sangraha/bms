"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import horizontalLogo from "@/app/assets/horizontal-logo.png";

import { useI18n } from "@/app/providers/I18nProvider";
import {
  getTokenFromAuthResponse,
  getUserFromAuthResponse,
  register as registerApi,
} from "@/handlers/auth";
import { syncStoredOutletFromAccessToken } from "@/lib/auth/role";
import { setAuthToken } from "@/lib/auth/token";
import { setStoredUser } from "@/lib/auth/user";
import { registerSchema, type RegisterFormValues } from "@/schema/auth";

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
    onSuccess: (result, values) => {
      if (result.ok) {
        const token = getTokenFromAuthResponse(result.data);
        if (token) {
          setAuthToken(token);
          syncStoredOutletFromAccessToken(token);
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
              "email" in user &&
              typeof user.email === "string" &&
              user.email.trim() !== ""
                ? user.email.trim()
                : undefined;
            setStoredUser({
              outletId: topOutletId ?? nestedId,
              outletName: nestedName,
              id:
                "id" in user && typeof user.id === "string"
                  ? user.id
                  : undefined,
              email: fromApiEmail ?? values.email.trim(),
            });
          } else {
            setStoredUser({ email: values.email.trim() });
          }
          navigate("/dashboard");
        } else {
          navigate("/login");
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

  const onSubmit = (data: RegisterFormValues) => {
    mutation.mutate(data);
  };

  const loading = mutation.isPending;
  const errorMessage = errors.root?.message;

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
          <CardTitle className="text-xl">{t("Create account")}</CardTitle>
          <CardDescription>
            {t("Register to get started with BMS.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <FormField
              id="register-username"
              label={t("User name")}
              error={errors.userName?.message}
            >
              <Input
                id="register-username"
                type="text"
                placeholder="e.g. John"
                autoComplete="username"
                aria-invalid={Boolean(errors.userName)}
                {...registerField("userName")}
              />
            </FormField>

            <FormField
              id="register-fullname"
              label={t("Full name")}
              error={errors.fullName?.message}
            >
              <Input
                id="register-fullname"
                type="text"
                placeholder="e.g. John Doe"
                autoComplete="name"
                aria-invalid={Boolean(errors.fullName)}
                {...registerField("fullName")}
              />
            </FormField>

            <FormField
              id="register-email"
              label={t("Email")}
              error={errors.email?.message}
            >
              <Input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...registerField("email")}
              />
            </FormField>

            <FormField
              id="register-password"
              label={t("Password")}
              error={errors.password?.message}
            >
              <Input
                id="register-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...registerField("password")}
              />
            </FormField>

            <FormField
              id="register-confirm"
              label={t("Confirm password")}
              error={errors.confirmPassword?.message}
            >
              <Input
                id="register-confirm"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...registerField("confirmPassword")}
              />
            </FormField>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {loading ? t("Creating account…") : t("Create account")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("Already have an account?")}{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("Sign in")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
