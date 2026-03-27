"use client";

import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CiSettings } from "react-icons/ci";
import { IoBagHandleOutline } from "react-icons/io5";
import { LuDownload, LuReceiptText, LuUserCog } from "react-icons/lu";
import { TbLayoutDashboard } from "react-icons/tb";
import LanguageToggle from "@/app/components/LanguageToggle/LanguageToggle";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { logout as logoutApi } from "@/handlers/auth";
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";

/** Menu link; permission "create" means link is shown only when user can create. */
type TranslationKey =
  | "dashboard"
  | "overview"
  | "outlets"
  | "users"
  | "departments"
  | "processingPlant"
  | "roles"
  | "salesBilling"
  | "analytics"
  | "pointOfSale"
  | "livestockSales"
  | "transactions"
  | "customerTypes"
  | "product"
  | "products"
  | "productType"
  | "pricelist"
  | "livestockCategory"
  | "live"
  | "processed"
  | "attendance"
  | "clockInOut"
  | "directory"
  | "settings"
  | "logout"
  | "closeMenu";

type MenuItem = {
  labelKey: TranslationKey;
  href: string;
  permission?: "create";
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const sidebarLabelMap: Record<TranslationKey, string> = {
  dashboard: "Dashboard",
  overview: "Overview",
  outlets: "Outlets",
  users: "Users",
  departments: "Departments",
  processingPlant: "Processing Plant",
  roles: "Roles",
  salesBilling: "Sales & Billing",
  analytics: "Analytics",
  pointOfSale: "Point of Sale",
  livestockSales: "Livestock Sales",
  transactions: "Transactions",
  customerTypes: "Customer Types",
  product: "Product",
  products: "Products",
  productType: "Product Type",
  pricelist: "Pricelist",
  livestockCategory: "Livestock Category",
  live: "Live Stock",
  processed: "Processed",
  attendance: "Attendance",
  clockInOut: "Clock In/Out",
  directory: "Directory",
  settings: "Settings",
  logout: "Logout",
  closeMenu: "Close menu",
};

const sidebarConfig = {
  header: { title: "HMP" },
  sections: [
    {
      items: [
        {
          id: "dashboard",
          href: "#",
          icon: <TbLayoutDashboard size={20} />,
          menu: {
            titleKey: "dashboard" as const,
            items: [
              { labelKey: "overview", href: "/dashboard" },
              { labelKey: "outlets", href: "/dashboard/settings/outlet" },
              { labelKey: "users", href: "/dashboard/settings/users" },
              { labelKey: "departments", href: "/dashboard/settings/departments" },
              { labelKey: "processingPlant", href: "/dashboard/settings/processingPlant" },
              { labelKey: "roles", href: "/dashboard/accounts/roles" },
              // { label: "Analytics", href: "/dashboard/analytics" },
              // { label: "Reports", href: "/dashboard/reports" },
            ] as MenuItem[],
          },
        },
        {
          id: "Sales & Billing",
          href: "#",
          icon: <LuReceiptText size={20} />,
          menu: {
            titleKey: "salesBilling" as const,
            items: [
              { labelKey: "analytics", href: "/dashboard/invoices" },
              { labelKey: "pointOfSale", href: "/dashboard/invoices/new", permission: "create" as const },
              { labelKey: "livestockSales", href: "/dashboard/invoices/livestock-sales", permission: "create" as const },
              { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
              { labelKey: "customerTypes", href: "/dashboard/invoices/customer-types" },
            ] as MenuItem[],
          },
        },
        {
          id: "orders",
          href: "#",
          icon: <IoBagHandleOutline size={20} />,
          menu: {
            titleKey: "product" as const,
            items: [
              { labelKey: "products", href: "/dashboard/product" },
              { labelKey: "productType", href: "/dashboard/product/productType" },
              { labelKey: "pricelist", href: "/dashboard/settings/dualPricing" },
              { labelKey: "livestockCategory", href: "/dashboard/product/livestockCategory" },
              { labelKey: "live", href: "/dashboard/product/liveProduct" },
              { labelKey: "processed", href: "/dashboard/product/processedProduct" },

            ] as MenuItem[],
          },
        },
        {
          id: "accounts",
          href: "#",
          icon: <LuUserCog size={20} />,
          menu: {
            titleKey: "attendance" as const,
            items: [
              { labelKey: "analytics", href: "/dashboard/accounts/analytics" },
              { labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out" },
              { labelKey: "directory", href: "/dashboard/accounts/directory" },
            ] as MenuItem[],
          },
        },
      ],
    },
  ],
  footer: [
    {
      items: [
        // {
        //   id: "teams",
        //   href: "#",
        //   icon: <FiUsers size={20} />,
        //   menu: {
        //     title: "Teams",
        //     items: [
        //       { label: "Team members", href: "/dashboard/teams" },
        //       { label: "Invitations", href: "/dashboard/teams/invitations" },
        //       { label: "Access", href: "/dashboard/teams/access" },
        //     ] as MenuItem[],
        //   },
        // },
        {
          id: "settings",
          href: "#",
          icon: <CiSettings size={20} />,
          menu: {
            titleKey: "settings" as const,
            items: [
              { labelKey: "outlets", href: "/dashboard/settings/outlet" },
              { labelKey: "users", href: "/dashboard/settings/users" },
              { labelKey: "departments", href: "/dashboard/settings/departments" },
              { labelKey: "processingPlant", href: "/dashboard/settings/processingPlant" },
              { labelKey: "roles", href: "/dashboard/accounts/roles" },
            ] as MenuItem[],
          },
        },
      ],
    },
  ],
};

export default function Sidebar() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { t, locale } = useI18n();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const allItems = useMemo(
    () => [
      ...sidebarConfig.sections.flatMap((section) => section.items),
      ...sidebarConfig.footer.flatMap((section) => section.items),
    ],
    []
  );

  const activeMenu = allItems.find((item) => item.id === activeMenuId)?.menu;
  const getSidebarLabel = useCallback(
    (key: TranslationKey) => {
      if (locale === "ne") {
        if (key === "live") return "जीवित पशुधन";
        if (key === "livestockCategory") return "पशुधन श्रेणी";
        if (key === "livestockSales") return "पशुधन बिक्री";
        if (key === "processingPlant") return "प्रशोधन केन्द्र";
      }
      return t(sidebarLabelMap[key]);
    },
    [locale, t]
  );
  const handleMenuToggle = (id: string) => {
    setActiveMenuId((current) => (current === id ? null : id));
  };

  const handleLogout = async () => {
    await logoutApi();
    clearAuthToken();
    clearStoredUser();
    setActiveMenuId(null);
    navigate("/login");
  };

  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setShowInstallButton(true);
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
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
    mq.addEventListener("change", handler);
    return () => {
      mq.removeEventListener("change", handler);
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

  return (
    <div className="sidebarWrapper">
      <aside className="sidebar" aria-label="Primary">
        <div className="header">
          <h2 className="title">{sidebarConfig.header.title}</h2>
        </div>

        <nav className="nav">
          {sidebarConfig.sections.map((section) => (
            <div key={section.items[0].id}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={
                    activeMenuId === item.id ? "link active" : "link"
                  }
                  type="button"
                  aria-pressed={activeMenuId === item.id}
                  onClick={() => handleMenuToggle(item.id)}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="footer">
          <LanguageToggle className="link" />
          {showInstallButton && (
            <button
              type="button"
              className="link"
              onClick={handleInstallClick}
              aria-label={t("Install App")}
              title={t("Install App")}
            >
              <LuDownload size={20} />
            </button>
          )}
          {sidebarConfig.footer[0].items
            .filter((item) => !isMobile || item.id !== "settings")
            .map((item) => (
              <button
                key={item.id}
                className={activeMenuId === item.id ? "link active" : "link"}
                type="button"
                aria-pressed={activeMenuId === item.id}
                onClick={() => handleMenuToggle(item.id)}
              >
                {item.icon}
              </button>
            ))}
        </div>
      </aside>

      {activeMenu && (
        <button
          type="button"
          className="drawerBackdrop visible"
          onClick={() => setActiveMenuId(null)}
          aria-label={t("Close menu")}
        />
      )}
      <div className={activeMenu ? "drawer open" : "drawer"}>
        <div className="drawerHeader">
          <span className="drawerTitle">
            {activeMenu ? getSidebarLabel(activeMenu.titleKey) : ""}
          </span>
          <button
            type="button"
            className="drawerClose"
            onClick={() => setActiveMenuId(null)}
            aria-label={t("Close menu")}
          >
            ×
          </button>
        </div>
        <div className="drawerBody">
          {activeMenu?.items
            .filter((entry) => (entry.permission === "create" ? canCreate : true))
            .map((entry) => (
              <Link
                key={entry.href}
                className="drawerItem"
                to={entry.href}
                onClick={() => setActiveMenuId(null)}
              >
                {getSidebarLabel(entry.labelKey)}
              </Link>
            ))}
        </div>
        <div className="drawerFooter">
          <button
            type="button"
            className="drawerItemLogout"
            onClick={handleLogout}
          >
            {t("Logout")}
          </button>
        </div>
      </div>
   
    </div>
  );
}
