"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Toast, { type ToastVariant } from "@/app/components/Toast/Toast";
import "@/app/components/Toast/Toast.scss";

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

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = "error") => {
    setToast({ message, variant });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="toastContainer">
          <Toast
            message={toast.message}
            variant={toast.variant}
            onDismiss={dismiss}
          />
        </div>
      )}
    </ToastContext.Provider>
  );
}
