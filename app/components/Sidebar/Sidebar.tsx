"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { CiSettings } from "react-icons/ci";
import { IoBusinessOutline, IoChevronDown } from "react-icons/io5";
import { LuDownload } from "react-icons/lu";
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
  | "processedProductsOutlet"
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
  | "closeMenu"
  | "highland";

type MenuItem = {
  labelKey: TranslationKey;
  href: string;
  permission?: "create";
};

type MenuSectionBlock = {
  titleKey: TranslationKey;
  items: MenuItem[];
};

/** Flat list (default drawer) or grouped sections (e.g. Highland). */
type RailMenu =
  | { titleKey: TranslationKey; items: MenuItem[] }
  | { titleKey: TranslationKey; sections: MenuSectionBlock[] };

function isGroupedRailMenu(menu: RailMenu): menu is { titleKey: TranslationKey; sections: MenuSectionBlock[] } {
  return "sections" in menu && Array.isArray(menu.sections) && menu.sections.length > 0;
}

function getFlatMenuItems(menu: RailMenu): MenuItem[] {
  if (isGroupedRailMenu(menu)) {
    return menu.sections.flatMap((section) => section.items);
  }
  return menu.items;
}

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
  pointOfSale: "Processed Sale",
  livestockSales: "Livestock Sales",
  transactions: "Transactions",
  customerTypes: "Customer Types",
  product: "Product",
  products: "Products",
  processedProductsOutlet: "Processed Products",
  productType: "Product Type",
  pricelist: "Pricelist",
  livestockCategory: "Livestock Category",
  live: "Live Stock Inventory",
  processed: "Processed Inventory",
  attendance: "Attendance",
  clockInOut: "Clock In/Out",
  directory: "Directory",
  settings: "Settings",
  logout: "Logout",
  closeMenu: "Close menu",
  highland: "Highland",
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
              // { labelKey: "processingPlant", href: "/dashboard/settings/processingPlant" },
              { labelKey: "roles", href: "/dashboard/accounts/roles" },
              // { label: "Analytics", href: "/dashboard/analytics" },
              // { label: "Reports", href: "/dashboard/reports" },
            ] as MenuItem[],
          },
        },
        // {
        //   id: "Sales & Billing",
        //   href: "#",
        //   icon: <LuReceiptText size={20} />,
        //   menu: {
        //     titleKey: "salesBilling" as const,
        //     items: [
        //       { labelKey: "analytics", href: "/dashboard/invoices" },
        //       { labelKey: "pointOfSale", href: "/dashboard/invoices/new", permission: "create" as const },
        //       { labelKey: "livestockSales", href: "/dashboard/invoices/livestock-sales", permission: "create" as const },
        //       { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
        //       { labelKey: "customerTypes", href: "/dashboard/invoices/customer-types" },
        //     ] as MenuItem[],
        //   },
        // },
        // {
        //   id: "orders",
        //   href: "#",
        //   icon: <IoBagHandleOutline size={20} />,
        //   menu: {
        //     titleKey: "product" as const,
        //     items: [
        //       { labelKey: "products", href: "/dashboard/product" },
        //       { labelKey: "productType", href: "/dashboard/product/productType" },
        //       { labelKey: "pricelist", href: "/dashboard/settings/dualPricing" },
        //       { labelKey: "livestockCategory", href: "/dashboard/product/livestockCategory" },
        //       { labelKey: "live", href: "/dashboard/product/liveProduct" },
        //       { labelKey: "processed", href: "/dashboard/product/processedProduct" },
        //
        //     ] as MenuItem[],
        //   },
        // },
        // {
        //   id: "accounts",
        //   href: "#",
        //   icon: <LuUserCog size={20} />,
        //   menu: {
        //     titleKey: "attendance" as const,
        //     items: [
        //       { labelKey: "analytics", href: "/dashboard/accounts/analytics" },
        //       { labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out" },
        //       { labelKey: "directory", href: "/dashboard/accounts/directory" },
        //     ] as MenuItem[],
        //   },
        // },
        {
          id: "highland",
          href: "#",
          icon: <IoBusinessOutline size={20} />,
          menu: {
            titleKey: "highland" as const,
            sections: [
              {
                titleKey: "dashboard",
                items: [
                  {
                    labelKey: "processingPlant",
                    href: "/dashboard/settings/processingPlant",
                  },
                ],
              },
              {
                titleKey: "salesBilling",
                items: [
                  { labelKey: "analytics", href: "/dashboard/invoices" },
                  {
                    labelKey: "pointOfSale",
                    href: "/dashboard/invoices/new",
                    permission: "create" as const,
                  },
                  {
                    labelKey: "livestockSales",
                    href: "/dashboard/invoices/livestock-sales",
                    permission: "create" as const,
                  },
                  { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
                  { labelKey: "customerTypes", href: "/dashboard/invoices/customer-types" },
                ],
              },
              {
                titleKey: "product",
                items: [
                  { labelKey: "productType", href: "/dashboard/product/productType" },
                  { labelKey: "livestockCategory", href: "/dashboard/product/livestockCategory" },
                  { labelKey: "live", href: "/dashboard/product/liveProduct" },
                  { labelKey: "processedProductsOutlet", href: "/dashboard/product" },
                  { labelKey: "processed", href: "/dashboard/product/processedProduct" },
                  { labelKey: "pricelist", href: "/dashboard/settings/dualPricing" },
                ],
              },
              {
                titleKey: "attendance",
                items: [
                  { labelKey: "analytics", href: "/dashboard/accounts/analytics" },
                  { labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out" },
                  { labelKey: "directory", href: "/dashboard/accounts/directory" },
                ],
              },
            ],
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

type SidebarRailItem =
  | (typeof sidebarConfig.sections)[number]["items"][number]
  | (typeof sidebarConfig.footer)[number]["items"][number];

/** Overview is `/dashboard` only; other hrefs allow nested paths (e.g. roles/create). */
function hrefMatchesPathname(href: string, pathname: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function longestMatchingHrefInMenu(
  items: MenuItem[],
  pathname: string
): string | null {
  const matches = items
    .filter((entry) => hrefMatchesPathname(entry.href, pathname))
    .map((entry) => entry.href);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

/**
 * Picks which primary rail icon is "active" for the current route.
 * When several rails share the same matching href length (e.g. Highland vs Dashboard),
 * prefer the rail whose drawer is open (`openMenuId`), then settings for /dashboard/settings,
 * then first in rail order.
 */
function getActivePrimaryId(
  pathname: string,
  railItems: SidebarRailItem[],
  canCreate: boolean,
  openMenuId: string | null
): string | null {
  type Candidate = { id: string; hrefLen: number };
  const candidates: Candidate[] = [];

  for (const item of railItems) {
    const flat = getFlatMenuItems(item.menu as RailMenu);
    const visible = flat.filter(
      (entry) => entry.permission !== "create" || canCreate
    );
    const longest = longestMatchingHrefInMenu(visible, pathname);
    if (longest) {
      candidates.push({ id: item.id, hrefLen: longest.length });
    }
  }

  if (candidates.length === 0) return null;

  const maxLen = Math.max(...candidates.map((c) => c.hrefLen));
  const tied = candidates.filter((c) => c.hrefLen === maxLen);
  if (tied.length === 1) return tied[0].id;

  if (pathname.startsWith("/dashboard/settings")) {
    const settingsHit = tied.find((c) => c.id === "settings");
    if (settingsHit) return "settings";
  }

  const openTie = openMenuId ? tied.find((c) => c.id === openMenuId) : undefined;
  if (openTie) return openTie.id;

  const order = railItems.map((i) => i.id);
  tied.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return tied[0].id;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const pathname = location.pathname;
  const primaryRailItems = useMemo(
    () => [
      ...sidebarConfig.sections.flatMap((section) => section.items),
      ...sidebarConfig.footer.flatMap((section) => section.items),
    ],
    []
  );
  const activePrimaryId = useMemo(
    () => getActivePrimaryId(pathname, primaryRailItems, canCreate, activeMenuId),
    [pathname, primaryRailItems, canCreate, activeMenuId]
  );

  const activeMenu = allItems.find((item) => item.id === activeMenuId)?.menu;
  const activeHrefInOpenMenu = useMemo(() => {
    if (!activeMenu) return null;
    const visible = getFlatMenuItems(activeMenu as RailMenu).filter(
      (entry) => entry.permission !== "create" || canCreate
    );
    return longestMatchingHrefInMenu(visible, pathname);
  }, [activeMenu, pathname, canCreate]);
  const getSidebarLabel = useCallback(
    (key: TranslationKey) => {
      if (locale === "ne") {
        if (key === "live") return "लाइभ स्टक इन्वेन्टरी";
        if (key === "livestockCategory") return "पशुधन श्रेणी";
        if (key === "livestockSales") return "पशुधन बिक्री";
        if (key === "processingPlant") return "प्रशोधन केन्द्र";
        if (key === "highland") return "हाइल्याण्ड";
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
  /** Grouped drawer (e.g. Highland): which section accordion is expanded. */
  const [groupedDrawerAccordionKey, setGroupedDrawerAccordionKey] =
    useState<TranslationKey | null>(null);

  useLayoutEffect(() => {
    if (!activeMenuId) return;
    const menu = allItems.find((item) => item.id === activeMenuId)?.menu;
    if (!menu || !isGroupedRailMenu(menu as RailMenu)) return;

    const sections = (menu as RailMenu & { sections: MenuSectionBlock[] }).sections;
    const visibleBlocks = sections
      .map((section) => ({
        section,
        items: section.items.filter((entry) =>
          entry.permission === "create" ? canCreate : true
        ),
      }))
      .filter((b) => b.items.length > 0);

    const withActive = visibleBlocks.find((b) =>
      b.items.some((entry) => activeHrefInOpenMenu === entry.href)
    );
    const nextKey = (withActive ?? visibleBlocks[0])?.section.titleKey ?? null;
    setGroupedDrawerAccordionKey(nextKey);
  }, [activeMenuId, pathname, canCreate, activeHrefInOpenMenu, allItems]);

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
                    activePrimaryId === item.id ? "link active" : "link"
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
                className={activePrimaryId === item.id ? "link active" : "link"}
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
          {activeMenu &&
            (isGroupedRailMenu(activeMenu as RailMenu)
              ? (activeMenu as RailMenu & { sections: MenuSectionBlock[] }).sections.map(
                  (section) => {
                    const visibleItems = section.items.filter((entry) =>
                      entry.permission === "create" ? canCreate : true
                    );
                    if (visibleItems.length === 0) return null;

                    const panelId = `drawer-section-${section.titleKey}`;
                    const isAccordionOpen =
                      groupedDrawerAccordionKey === section.titleKey;

                    return (
                      <div key={section.titleKey} className="drawerAccordionSection">
                        <button
                          type="button"
                          className="drawerAccordionTrigger"
                          aria-expanded={isAccordionOpen}
                          aria-controls={panelId}
                          id={`drawer-trigger-${section.titleKey}`}
                          onClick={() =>
                            setGroupedDrawerAccordionKey((current) =>
                              current === section.titleKey ? null : section.titleKey
                            )
                          }
                        >
                          <span className="drawerAccordionTriggerLabel">
                            {getSidebarLabel(section.titleKey)}
                          </span>
                          <IoChevronDown
                            className={
                              isAccordionOpen
                                ? "drawerAccordionChevron open"
                                : "drawerAccordionChevron"
                            }
                            aria-hidden
                            size={20}
                          />
                        </button>
                        {isAccordionOpen && (
                          <div
                            className="drawerAccordionPanel"
                            id={panelId}
                            role="region"
                            aria-labelledby={`drawer-trigger-${section.titleKey}`}
                          >
                            {visibleItems.map((entry) => (
                              <Link
                                key={`${section.titleKey}-${entry.labelKey}-${entry.href}`}
                                className={
                                  activeHrefInOpenMenu === entry.href
                                    ? "drawerItem drawerItemNested active"
                                    : "drawerItem drawerItemNested"
                                }
                                to={entry.href}
                                onClick={() => setActiveMenuId(null)}
                                aria-current={
                                  activeHrefInOpenMenu === entry.href
                                    ? "page"
                                    : undefined
                                }
                              >
                                {getSidebarLabel(entry.labelKey)}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                )
              : (activeMenu as { items: MenuItem[] }).items
                  .filter((entry) =>
                    entry.permission === "create" ? canCreate : true
                  )
                  .map((entry) => (
                    <Link
                      key={entry.href}
                      className={
                        activeHrefInOpenMenu === entry.href
                          ? "drawerItem active"
                          : "drawerItem"
                      }
                      to={entry.href}
                      onClick={() => setActiveMenuId(null)}
                      aria-current={
                        activeHrefInOpenMenu === entry.href ? "page" : undefined
                      }
                    >
                      {getSidebarLabel(entry.labelKey)}
                    </Link>
                  )))}
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
