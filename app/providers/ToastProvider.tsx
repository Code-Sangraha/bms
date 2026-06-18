"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { createContext, useContext } from "react";
import { toast } from "sonner";

import { Toaster } from "@/app/components/ui/sonner";

export type ToastVariant = "error" | "success" | "info" | "warning";

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

/**
 * Backwards-compatible provider over Sonner. Every existing call site uses
 * `useToast().showToast(message, variant)` — the API is unchanged, only the
 * rendering layer was swapped.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback(
    (message: string, variant: ToastVariant = "error") => {
      switch (variant) {
        case "success":
          toast.success(message);
          return;
        case "info":
          toast.info(message);
          return;
        case "warning":
          toast.warning(message);
          return;
        case "error":
          toast.error(message);
          return;
        default: {
          const _exhaustive: never = variant;
          void _exhaustive;
          toast(message);
        }
      }
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}
