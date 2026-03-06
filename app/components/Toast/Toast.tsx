"use client";

import { useEffect } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import "./Toast.scss";

export type ToastVariant = "error" | "success" | "info";

type ToastProps = {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
};

export default function Toast({
  message,
  variant = "error",
  onDismiss,
  duration = 5000,
}: ToastProps) {
  const { t } = useI18n();

  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div
      className={`toast toast${variant.charAt(0).toUpperCase() + variant.slice(1)}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="toastMessage">{message}</span>
      <button
        type="button"
        className="toastClose"
        onClick={onDismiss}
        aria-label={t("Dismiss")}
      >
        ×
      </button>
    </div>
  );
}
