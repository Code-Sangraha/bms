"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  IoBusinessOutline,
  IoChevronForward,
  IoLogOutOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoPricetagOutline,
  IoSchoolOutline,
  IoStatsChartOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { LuDownload } from "react-icons/lu";
import LanguageToggle from "@/app/components/LanguageToggle/LanguageToggle";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { logout as logoutApi } from "@/handlers/auth";
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser, getStoredUser } from "@/lib/auth/user";
import { buildPathWithOutletScope, readOutletScopeFromSearch } from "@/lib/outletScope";
import "./more.scss";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function userDisplayName(): string {
  const u = getStoredUser();
  if (!u) return "BMS";
  const name =
    (typeof u.name === "string" && u.name) ||
    (typeof u.email === "string" && u.email) ||
    (typeof u.username === "string" && u.username);
  return typeof name === "string" && name.trim() ? name.trim() : "BMS";
}

function userInitial(): string {
  const n = userDisplayName();
  return n.trim().charAt(0).toUpperCase() || "B";
}

export default function MorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search } = useLocation();
  const { t } = useI18n();
  const { roleName } = usePermissions();
  const { accessTier } = useOutletAccess();
  const scopedOutletId = useMemo(() => readOutletScopeFromSearch(search), [search]);

  const to = useCallback(
    (path: string) => buildPathWithOutletScope(path, scopedOutletId, search),
    [scopedOutletId, search]
  );

  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    setShowInstallButton(true);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };
    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowInstallButton(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      setDeferredInstallPrompt(null);
      return;
    }
    const el = document.getElementById("pwa-install") as
      | (HTMLElement & { showDialog?: () => void; show?: () => void })
      | null;
    el?.showDialog?.();
    if (!el?.showDialog && el?.show) el.show();
  }, [deferredInstallPrompt]);

  const handleLogout = async () => {
    await logoutApi();
    void queryClient.cancelQueries();
    queryClient.clear();
    clearAuthToken();
    clearStoredUser();
    navigate("/login");
  };

  const mainLinks = useMemo(() => {
    if (accessTier !== "global") return [];
    return [
      { href: to("/dashboard/outlet"), label: t("Outlets"), icon: IoBusinessOutline },
      { href: to("/dashboard/users"), label: t("Users"), icon: IoPeopleOutline },
      { href: to("/dashboard/departments"), label: t("Departments"), icon: IoSchoolOutline },
      { href: to("/dashboard/processingPlant"), label: t("Processing Plant"), icon: IoBusinessOutline },
      { href: to("/dashboard/accounts/roles"), label: t("Roles"), icon: IoPersonOutline },
    ] as const;
  }, [accessTier, t, to]);

  const otherLinks = useMemo(() => {
    if (accessTier === "global") {
      return [
        { href: to("/dashboard/accounts/analytics"), label: t("Attendance"), icon: IoStatsChartOutline },
        { href: to("/dashboard/accounts/clock-in-out"), label: t("Clock In/Out"), icon: IoTimeOutline },
        { href: to("/dashboard/invoices/customer-types"), label: t("Customer Types"), icon: IoPricetagOutline },
        {
          href: to("/dashboard/invoices"),
          label: t("Sales & Billing"),
          icon: IoStatsChartOutline,
        },
      ] as const;
    }
    if (accessTier === "outlet_manager") {
      return [
        { href: to("/dashboard/accounts/analytics"), label: t("Attendance"), icon: IoStatsChartOutline },
        { href: to("/dashboard/accounts/clock-in-out"), label: t("Clock In/Out"), icon: IoTimeOutline },
        { href: to("/dashboard/outlet"), label: t("Outlets"), icon: IoBusinessOutline },
        { href: to("/dashboard/dualPricing"), label: t("Pricelist"), icon: IoPricetagOutline },
        {
          href: to("/dashboard/invoices"),
          label: t("Sales & Billing"),
          icon: IoStatsChartOutline,
        },
      ] as const;
    }
    if (accessTier === "outlet_staff") {
      return [
        { href: to("/dashboard/accounts/clock-in-out"), label: t("Clock In/Out"), icon: IoTimeOutline },
        {
          href: to("/dashboard/invoices"),
          label: t("Sales & Billing"),
          icon: IoStatsChartOutline,
        },
        {
          href: to("/dashboard/product"),
          label: t("Inventory"),
          icon: IoBusinessOutline,
        },
      ] as const;
    }
    if (accessTier === "driver") {
      return [
        { href: to("/dashboard/accounts/clock-in-out"), label: t("Clock In/Out"), icon: IoTimeOutline },
      ] as const;
    }
    return [] as const;
  }, [accessTier, t, to]);

  return (
    <section className="morePage">
      <header className="morePage__header">
        <div className="morePage__avatar" aria-hidden>
          {userInitial()}
        </div>
        <div className="morePage__titles">
          <h1 className="morePage__title">{userDisplayName()}</h1>
          <p className="morePage__subtitle">{roleName ?? t("Admin")}</p>
        </div>
      </header>

      {mainLinks.length > 0 ? (
        <>
          <h2 className="morePage__sectionLabel">{t("Settings")}</h2>
          <div className="morePage__card">
            {mainLinks.map((row) => (
              <Link key={row.href} to={row.href} className="morePage__row">
                <span className="morePage__rowIcon" aria-hidden>
                  <row.icon size={22} />
                </span>
                <span className="morePage__rowLabel">{row.label}</span>
                <IoChevronForward className="morePage__chevron" size={18} aria-hidden />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="morePage__sectionLabel">{t("Others")}</h2>
      <div className="morePage__card">
        {otherLinks.map((row) => (
          <Link key={row.href} to={row.href} className="morePage__row">
            <span className="morePage__rowIcon" aria-hidden>
              <row.icon size={22} />
            </span>
            <span className="morePage__rowLabel">{row.label}</span>
            <IoChevronForward className="morePage__chevron" size={18} aria-hidden />
          </Link>
        ))}
        <div className="morePage__langRow">
          <span>{t("Language")}</span>
          <LanguageToggle />
        </div>
        {showInstallButton ? (
          <button type="button" className="morePage__row" onClick={() => void handleInstallClick()}>
            <span className="morePage__rowIcon" aria-hidden>
              <LuDownload size={22} />
            </span>
            <span className="morePage__rowLabel">{t("Install App")}</span>
            <IoChevronForward className="morePage__chevron" size={18} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="morePage__card" style={{ marginTop: 16 }}>
        <button type="button" className="morePage__row morePage__logout" onClick={() => void handleLogout()}>
          <span className="morePage__rowIcon" aria-hidden>
            <IoLogOutOutline size={22} />
          </span>
          <span className="morePage__rowLabel">{t("Logout")}</span>
        </button>
      </div>
    </section>
  );
}
