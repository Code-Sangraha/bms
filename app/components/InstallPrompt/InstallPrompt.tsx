import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/app/providers/I18nProvider";

const DISMISS_STORAGE_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissed) {
        const age = Date.now() - parseInt(dismissed, 10);
        if (age < 7 * 24 * 60 * 60 * 1000) return; // Don't show for 7 days after dismiss
      }
    } catch {
      // ignore
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-700">
            {t("Install BMS on your device for quick access.")}
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={t("Dismiss")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("Install App")}
          </button>
        </div>
      </div>
    </div>
  );
}
