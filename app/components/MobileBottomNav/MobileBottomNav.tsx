"use client";

import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, Home, LayoutGrid, Package, Receipt } from "lucide-react";
import type { AccessTier } from "@/lib/auth/accessTier";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import { mobileTabFromPathname, type MobileTabId } from "@/lib/mobileNav";
import { useI18n } from "@/app/providers/I18nProvider";
import "./MobileBottomNav.scss";

type MobileBottomNavProps = {
  /** When Highland plant scope is active, append `outletId` to tab targets. */
  scopedOutletId: string | null;
  accessTier: AccessTier;
  lockedOutletId: string | null;
};

const ICON_SIZE = 22;

function tabClass(active: boolean): string {
  return ["mobileBottomNav__tab", active ? "mobileBottomNav__tab--active" : ""].filter(Boolean).join(" ");
}

export default function MobileBottomNav({
  scopedOutletId,
  accessTier,
}: MobileBottomNavProps) {
  const { pathname, search } = useLocation();
  const { t } = useI18n();
  const active = mobileTabFromPathname(pathname, accessTier);

  const to = (path: string) => buildPathWithOutletScope(path, scopedOutletId, search);

  if (accessTier === "driver") {
    const href = to("/dashboard/accounts/clock-in-out");
    const isClockInOut = pathname.startsWith("/dashboard/accounts/clock-in-out");
    return (
      <nav className="mobileBottomNav" aria-label={t("Primary")}>
        <Link
          to={href}
          className={tabClass(isClockInOut || active === "clock")}
          aria-current={isClockInOut ? "page" : undefined}
        >
          <span className="mobileBottomNav__icon" aria-hidden>
            <Clock size={ICON_SIZE} />
          </span>
          <span className="mobileBottomNav__label">{t("Clock In/Out")}</span>
        </Link>
      </nav>
    );
  }

  const items: Array<{
    id: MobileTabId;
    href: string;
    label: string;
    icon: ReactNode;
  }> = [
    {
      id: "home",
      href: to("/dashboard"),
      label: t("Home"),
      icon: <Home size={ICON_SIZE} />,
    },
    {
      id: "transactions",
      href: to("/dashboard/invoices/new"),
      label: t("Transactions"),
      icon: <Receipt size={ICON_SIZE} />,
    },
    {
      id: "inventory",
      href: to("/dashboard/product/processedProduct"),
      label: t("Inventory"),
      icon: <Package size={ICON_SIZE} />,
    },
    {
      id: "more",
      href: to("/dashboard/more"),
      label: t("More"),
      icon: <LayoutGrid size={ICON_SIZE} />,
    },
  ];

  return (
    <nav className="mobileBottomNav" aria-label={t("Primary")}>
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.href}
          className={tabClass(active === item.id)}
          aria-current={active === item.id ? "page" : undefined}
        >
          <span className="mobileBottomNav__icon" aria-hidden>
            {item.icon}
          </span>
          <span className="mobileBottomNav__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
