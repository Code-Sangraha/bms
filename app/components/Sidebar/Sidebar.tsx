"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { IoBusinessOutline, IoChevronDown } from "react-icons/io5";
import { LuDownload } from "react-icons/lu";
import { TbBuildingFactory2, TbLayoutDashboard } from "react-icons/tb";
import LanguageToggle from "@/app/components/LanguageToggle/LanguageToggle";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { logout as logoutApi } from "@/handlers/auth";
import {
  getProcessingPlants,
  mergeProcessingPlantOutletFromUsers,
  type ProcessingPlant,
} from "@/handlers/processingPlant";
import { getOutlets } from "@/handlers/outlet";
import { getUsers } from "@/handlers/user";
import { resolveRowFilterOutletId, resolvedScopeOutletIdForPlant } from "@/lib/rowFilterOutlet";
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";
import {
  buildPathWithOutletScope,
  readHighlandContextFromStorage,
  readOutletScopeFromSearch,
  writeHighlandContextToStorage,
  type HighlandStoredContext,
} from "@/lib/outletScope";

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

const PROCESSING_PLANTS_QUERY_KEY = ["processingPlants"];
const USERS_QUERY_KEY = ["users"];
const OUTLETS_QUERY_KEY = ["outlets"];

/** Highland drawer: reduced menu when a processing plant (outlet scope) is selected. */
const highlandPlantMenuSections: MenuSectionBlock[] = [
  {
    titleKey: "dashboard",
    items: [{ labelKey: "overview", href: "/dashboard" }],
  },
  {
    titleKey: "salesBilling",
    items: [
      { labelKey: "analytics", href: "/dashboard/invoices" },
      { labelKey: "pointOfSale", href: "/dashboard/invoices/new", permission: "create" },
      { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
    ],
  },
  {
    titleKey: "product",
    items: [
      { labelKey: "processedProductsOutlet", href: "/dashboard/product" },
      { labelKey: "processed", href: "/dashboard/product/processedProduct" },
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
];

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
              { labelKey: "outlets", href: "/dashboard/outlet" },
              { labelKey: "users", href: "/dashboard/users" },
              { labelKey: "departments", href: "/dashboard/departments" },
              // { labelKey: "processingPlant", href: "/dashboard/processingPlant" },
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
        //       { labelKey: "pricelist", href: "/dashboard/dualPricing" },
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
                  { labelKey: "overview", href: "/dashboard" },
                  {
                    labelKey: "processingPlant",
                    href: "/dashboard/processingPlant",
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
                  { labelKey: "pricelist", href: "/dashboard/dualPricing" },
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
        // {
        //   id: "settings",
        //   href: "#",
        //   icon: <CiSettings size={20} />,
        //   menu: {
        //     titleKey: "settings" as const,
        //     items: [
        //       { labelKey: "outlets", href: "/dashboard/outlet" },
        //       { labelKey: "users", href: "/dashboard/users" },
        //       { labelKey: "departments", href: "/dashboard/departments" },
        //       { labelKey: "processingPlant", href: "/dashboard/processingPlant" },
        //       { labelKey: "roles", href: "/dashboard/accounts/roles" },
        //     ] as MenuItem[],
        //   },
        // },
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

function splitPathAndQuery(to: string): { pathname: string; query: string } {
  const q = to.indexOf("?");
  if (q === -1) return { pathname: to, query: "" };
  return { pathname: to.slice(0, q), query: to.slice(q + 1) };
}

/** Active drawer link: pathname match plus exact query match for scoped links; main links require no `outletId` in the URL. */
function drawerLinkIsActive(to: string, pathname: string, locationSearch: string): boolean {
  const { pathname: p, query } = splitPathAndQuery(to);
  if (!hrefMatchesPathname(p, pathname)) return false;
  const want = new URLSearchParams(query);
  if ([...want.keys()].length === 0) {
    return readOutletScopeFromSearch(locationSearch) == null;
  }
  const loc = new URLSearchParams(
    locationSearch.startsWith("?") ? locationSearch.slice(1) : locationSearch
  );
  for (const [k, v] of want) {
    if (loc.get(k) !== v) return false;
  }
  return true;
}

function longestActiveDrawerHref(
  sections: MenuSectionBlock[],
  canCreate: boolean,
  pathname: string,
  locationSearch: string,
  linkForItem: (href: string) => string
): string | null {
  const flat = sections.flatMap((section) =>
    section.items
      .filter((entry) => (entry.permission === "create" ? canCreate : true))
      .map((entry) => ({ href: entry.href, to: linkForItem(entry.href) }))
  );
  const matches = flat.filter((e) => drawerLinkIsActive(e.to, pathname, locationSearch));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (a.href.length >= b.href.length ? a : b)).href;
}

/**
 * Picks which primary rail icon is "active" for the current route.
 * When several rails share the same matching href length (e.g. Highland vs Dashboard),
 * prefer the rail whose drawer is open (`openMenuId`), then dashboard rail for org settings paths,
 * then first in rail order.
 */
function getActivePrimaryId(
  pathname: string,
  search: string,
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

  if (pathname === "/dashboard" && readOutletScopeFromSearch(search)) {
    const highlandHit = tied.find((c) => c.id === "highland");
    if (highlandHit) return "highland";
  }

  const dashboardOrgPaths = [
    "/dashboard/outlet",
    "/dashboard/users",
    "/dashboard/departments",
    "/dashboard/dualPricing",
    "/dashboard/processingPlant",
  ];
  if (
    dashboardOrgPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    const dashboardHit = tied.find((c) => c.id === "dashboard");
    if (dashboardHit) return "dashboard";
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
  const { showToast } = useToast();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [highlandContext, setHighlandContext] = useState<HighlandStoredContext>(() => {
    const stored = readHighlandContextFromStorage();
    return stored ?? { mode: "main" };
  });
  const allItems = useMemo(
    () => [
      ...sidebarConfig.sections.flatMap((section) => section.items),
      ...sidebarConfig.footer.flatMap((section) => section.items),
    ],
    []
  );

  const pathname = location.pathname;
  const locationSearch = location.search;

  const { data: processingPlants = [] } = useQuery({
    queryKey: PROCESSING_PLANTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProcessingPlants();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const result = await getUsers();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const processingPlantsForRail = useMemo(
    () => mergeProcessingPlantOutletFromUsers(processingPlants, users),
    [processingPlants, users]
  );

  const highlandMainSections = useMemo((): MenuSectionBlock[] => {
    const rail = sidebarConfig.sections[0].items.find((i) => i.id === "highland");
    const menu = rail?.menu as RailMenu | undefined;
    if (menu && isGroupedRailMenu(menu)) return menu.sections;
    return [];
  }, []);

  useEffect(() => {
    const oid = readOutletScopeFromSearch(locationSearch);
    if (!oid) return;
    const plant =
      processingPlantsForRail.find((p) => p.id === oid) ??
      processingPlantsForRail.find(
        (p) => resolveRowFilterOutletId(p.id, outlets, processingPlantsForRail) === oid
      ) ??
      processingPlantsForRail.find((p) => p.outletId === oid);
    if (!plant) return;
    const resolved = resolvedScopeOutletIdForPlant(plant, outlets, processingPlantsForRail);
    if (!resolved) return;
    const next: HighlandStoredContext = {
      mode: "plant",
      plantId: plant.id,
      outletId: resolved,
      plantName: plant.name,
    };
    setHighlandContext((prev) => {
      if (
        prev.mode === "plant" &&
        prev.plantId === next.plantId &&
        prev.outletId === next.outletId
      ) {
        return prev;
      }
      return next;
    });
    writeHighlandContextToStorage(next);
  }, [locationSearch, processingPlantsForRail, outlets]);

  const primaryRailItems = useMemo(
    () => [
      ...sidebarConfig.sections.flatMap((section) => section.items),
      ...sidebarConfig.footer.flatMap((section) => section.items),
    ],
    []
  );
  const activePrimaryId = useMemo(
    () =>
      getActivePrimaryId(
        pathname,
        locationSearch,
        primaryRailItems,
        canCreate,
        activeMenuId
      ),
    [pathname, locationSearch, primaryRailItems, canCreate, activeMenuId]
  );

  const activeMenu = allItems.find((item) => item.id === activeMenuId)?.menu;
  const activeHrefInOpenMenu = useMemo(() => {
    if (!activeMenu) return null;
    const visible = getFlatMenuItems(activeMenu as RailMenu).filter(
      (entry) => entry.permission !== "create" || canCreate
    );
    if (activeMenuId === "highland" && isGroupedRailMenu(activeMenu as RailMenu)) {
      const sections =
        highlandContext.mode === "plant" && highlandContext.outletId
          ? highlandPlantMenuSections
          : highlandMainSections;
      const linkFor = (href: string) =>
        highlandContext.mode === "plant" && highlandContext.outletId
          ? buildPathWithOutletScope(href, highlandContext.outletId, "")
          : href;
      return longestActiveDrawerHref(
        sections,
        canCreate,
        pathname,
        locationSearch,
        linkFor
      );
    }
    return longestMatchingHrefInMenu(visible, pathname);
  }, [
    activeMenu,
    pathname,
    locationSearch,
    canCreate,
    activeMenuId,
    highlandContext,
    highlandMainSections,
  ]);
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
  const handleMenuToggle = useCallback(
    (id: string) => {
      setActiveMenuId((current) => {
        const next = current === id ? null : id;
        if (id === "highland" && next === "highland") {
          const nextCtx: HighlandStoredContext = { mode: "main" };
          setHighlandContext(nextCtx);
          writeHighlandContextToStorage(nextCtx);
          navigate(buildPathWithOutletScope(pathname, null, locationSearch), {
            replace: true,
          });
        }
        return next;
      });
    },
    [navigate, pathname, locationSearch]
  );

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

    const sections =
      activeMenuId === "highland" && highlandContext.mode === "plant" && highlandContext.outletId
        ? highlandPlantMenuSections
        : (menu as RailMenu & { sections: MenuSectionBlock[] }).sections;
    const visibleBlocks = sections
      .map((section) => ({
        section,
        items: section.items.filter((entry) =>
          entry.permission === "create" ? canCreate : true
        ),
      }))
      .filter((b) => b.items.length > 0);

    const linkFor =
      activeMenuId === "highland" && highlandContext.mode === "plant" && highlandContext.outletId
        ? (href: string) => buildPathWithOutletScope(href, highlandContext.outletId, "")
        : (href: string) => href;

    const withActive = visibleBlocks.find((b) =>
      b.items.some((entry) =>
        drawerLinkIsActive(linkFor(entry.href), pathname, locationSearch)
      )
    );
    const nextKey = (withActive ?? visibleBlocks[0])?.section.titleKey ?? null;
    setGroupedDrawerAccordionKey(nextKey);
  }, [
    activeMenuId,
    pathname,
    locationSearch,
    canCreate,
    activeHrefInOpenMenu,
    allItems,
    highlandContext,
  ]);

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

  const handleSelectPlant = useCallback(
    (plant: ProcessingPlant) => {
      const resolved = resolvedScopeOutletIdForPlant(plant, outlets, processingPlantsForRail);
      if (!resolved) {
        showToast(t("Processing plant has no linked outlet yet."));
        return;
      }
      const nextCtx: HighlandStoredContext = {
        mode: "plant",
        plantId: plant.id,
        outletId: resolved,
        plantName: plant.name,
      };
      setHighlandContext(nextCtx);
      writeHighlandContextToStorage(nextCtx);
      setActiveMenuId("highland");
      // Do not navigate to a route here — the user chooses a page from the drawer. If the
      // URL still had `?outletId=` from another scope, remove it so URL sync cannot override
      // the plant we just selected.
      if (readOutletScopeFromSearch(locationSearch) != null) {
        navigate(
          buildPathWithOutletScope(pathname, null, locationSearch),
          { replace: true }
        );
      }
    },
    [locationSearch, navigate, outlets, pathname, processingPlantsForRail, showToast, t]
  );

  return (
    <div className="sidebarWrapper">
      <aside className="sidebar" aria-label="Primary">
        <div className="header">
          <h2 className="title">{sidebarConfig.header.title}</h2>
        </div>

        <nav className="nav">
          {sidebarConfig.sections.map((section) => (
            <div key={section.items[0].id}>
              {section.items.map((item) => {
                const isHighland = item.id === "highland";
                const railActive =
                  activePrimaryId === item.id &&
                  (!isHighland || highlandContext.mode === "main");
                return (
                  <button
                    key={item.id}
                    className={railActive ? "link active" : "link"}
                    type="button"
                    aria-label={getSidebarLabel(item.menu.titleKey)}
                    aria-pressed={activeMenuId === item.id}
                    title={getSidebarLabel(item.menu.titleKey)}
                    onClick={() => handleMenuToggle(item.id)}
                  >
                    <span className="mobileRailIcon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="mobileRailLabel">
                      {getSidebarLabel(item.menu.titleKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {processingPlantsForRail.map((plant: ProcessingPlant) => {
            const hasOutlet = Boolean(
              resolvedScopeOutletIdForPlant(plant, outlets, processingPlantsForRail)
            );
            const isActivePlant =
              highlandContext.mode === "plant" && highlandContext.plantId === plant.id;
            return (
              <button
                key={`plant-${plant.id}`}
                type="button"
                className={isActivePlant ? "link active" : "link"}
                disabled={!hasOutlet}
                title={
                  hasOutlet
                    ? plant.name
                    : t("Processing plant has no linked outlet yet.")
                }
                aria-label={plant.name}
                aria-pressed={isActivePlant}
                onClick={() => handleSelectPlant(plant)}
              >
                <span className="mobileRailIcon" aria-hidden>
                  <TbBuildingFactory2 size={20} />
                </span>
                <span className="mobileRailLabel">{plant.name}</span>
              </button>
            );
          })}
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
              <span className="mobileRailIcon" aria-hidden>
                <LuDownload size={20} />
              </span>
              <span className="mobileRailLabel">{t("Install")}</span>
            </button>
          )}
          {sidebarConfig.footer[0].items
            .filter((item) => !isMobile || item.id !== "settings")
            .map((item) => (
              <button
                key={item.id}
                className={activePrimaryId === item.id ? "link active" : "link"}
                type="button"
                aria-label={getSidebarLabel(item.menu.titleKey)}
                aria-pressed={activeMenuId === item.id}
                title={getSidebarLabel(item.menu.titleKey)}
                onClick={() => handleMenuToggle(item.id)}
              >
                <span className="mobileRailIcon" aria-hidden>
                  {item.icon}
                </span>
                <span className="mobileRailLabel">
                  {getSidebarLabel(item.menu.titleKey)}
                </span>
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
              ? (
                  activeMenuId === "highland" && highlandContext.mode === "plant"
                    ? highlandPlantMenuSections
                    : (activeMenu as RailMenu & { sections: MenuSectionBlock[] }).sections
                ).map((section) => {
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
                                {visibleItems.map((entry) => {
                                  const to =
                                    activeMenuId === "highland" &&
                                    highlandContext.mode === "plant" &&
                                    highlandContext.outletId
                                      ? buildPathWithOutletScope(
                                          entry.href,
                                          highlandContext.outletId,
                                          ""
                                        )
                                      : entry.href;
                                  const isActive = drawerLinkIsActive(
                                    to,
                                    pathname,
                                    locationSearch
                                  );
                                  return (
                                    <Link
                                      key={`${section.titleKey}-${entry.labelKey}-${entry.href}`}
                                      className={
                                        isActive
                                          ? "drawerItem drawerItemNested active"
                                          : "drawerItem drawerItemNested"
                                      }
                                      to={to}
                                      onClick={() => setActiveMenuId(null)}
                                      aria-current={isActive ? "page" : undefined}
                                    >
                                      {getSidebarLabel(entry.labelKey)}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
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
