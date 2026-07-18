"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { IoBusinessOutline } from "react-icons/io5";
import { LuDownload } from "react-icons/lu";
import { TbBuildingFactory2, TbLayoutDashboard } from "react-icons/tb";
import { X } from "lucide-react";
import squareLogo from "@/app/assets/square-logo.png";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { Button } from "@/app/components/ui/button";
import LanguageToggle from "@/app/components/LanguageToggle/LanguageToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav/MobileBottomNav";
import { useToast } from "@/app/providers/ToastProvider";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { logout as logoutApi } from "@/handlers/auth";
import type { RoleCapabilities } from "@/lib/auth/capabilities";
import { getOutlets, getMainOutletId, getSubOutletsForScope, type Outlet } from "@/handlers/outlet";
import { getAccessTierFromSessionClaims } from "@/lib/auth/accessTier";
import { clearAuthToken } from "@/lib/auth/token";
import { clearStoredUser } from "@/lib/auth/user";
import {
  buildPathWithOutletScope,
  readHighlandContextFromStorage,
  readOutletScopeFromSearch,
  writeHighlandContextToStorage,
  type HighlandStoredContext,
} from "@/lib/outletScope";
import { twoLetterLabelFromPlantName } from "@/lib/processingPlantButtonLabel";
import { useMainOutletInventoryAccess } from "@/app/hooks/useMainOutletInventoryAccess";

/** Menu link; permission "create" means link is shown only when user can create. */
type TranslationKey =
  | "dashboard"
  | "overview"
  | "outlets"
  | "users"
  | "departments"
  | "processingPlant"
  | "roles"
  | "itemInventory"
  | "salesBilling"
  | "analytics"
  | "salesDashboard"
  | "pointOfSale"
  | "wasteSales"
  | "livestockSales"
  | "outletExpenses"
  | "transactions"
  | "customers"
  | "suppliers"
  | "customerTypes"
  | "loyaltyRules"
  | "product"
  | "products"
  | "processedProductsOutlet"
  | "productType"
  | "pricelist"
  | "livestockCategory"
  | "live"
  | "processed"
  | "wasteProducts"
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
  capability?: keyof RoleCapabilities;
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

function menuItemIsVisible(
  entry: MenuItem,
  canCreate: boolean,
  capabilities: RoleCapabilities
): boolean {
  if (entry.capability && !capabilities[entry.capability]) return false;
  if (entry.permission === "create" && !canCreate) return false;
  return true;
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
  itemInventory: "Item Inventory",
  salesBilling: "Sales & Billing",
  analytics: "Analytics",
  salesDashboard: "Sales Dashboard",
  pointOfSale: "Processed Sale",
  wasteSales: "Waste Sales",
  livestockSales: "Livestock Sales",
  outletExpenses: "Outlet expenses",
  transactions: "Transactions",
  customers: "Customers",
  suppliers: "Suppliers",
  customerTypes: "Customer Types",
  loyaltyRules: "Loyalty Rules",
  product: "Product",
  products: "Products",
  processedProductsOutlet: "Processed Products",
  productType: "Product Type",
  pricelist: "Pricelist",
  livestockCategory: "Livestock Category",
  live: "Live Stock Inventory",
  processed: "Processed Inventory",
  wasteProducts: "Waste Products",
  attendance: "Attendance",
  clockInOut: "Clock In/Out",
  directory: "Directory",
  settings: "Settings",
  logout: "Logout",
  closeMenu: "Close menu",
  highland: "Highland",
};

const OUTLETS_QUERY_KEY = ["outlets"];

/** Highland drawer: reduced menu when a sub-outlet scope is selected (`?outletId=`). */
const highlandPlantMenuSections: MenuSectionBlock[] = [
  {
    titleKey: "dashboard",
    items: [{ labelKey: "overview", href: "/dashboard" }],
  },
  {
    titleKey: "salesBilling",
    items: [
      { labelKey: "analytics", href: "/dashboard/invoices" },
      { labelKey: "pointOfSale", href: "/dashboard/invoices/new", capability: "canCreateProcessedSales" },
      { labelKey: "wasteSales", href: "/dashboard/invoices/waste-sales", capability: "canCreateProcessedSales" },
      { labelKey: "livestockSales", href: "/dashboard/invoices/livestock-sales", capability: "canCreateLivestockSales" },
      { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
      { labelKey: "customers", href: "/dashboard/invoices/customers" },
    ],
  },
  {
    titleKey: "product",
    items: [
      { labelKey: "live", href: "/dashboard/product/liveProduct", capability: "canViewLivestockInventory" },
      { labelKey: "processedProductsOutlet", href: "/dashboard/product" },
      { labelKey: "processed", href: "/dashboard/product/processedProduct", capability: "canViewProcessedInventory" },
      { labelKey: "wasteProducts", href: "/dashboard/product/wasteProduct", capability: "canViewProcessedInventory" },
      { labelKey: "pricelist", href: "/dashboard/dualPricing", capability: "canViewDualPricing" },
      { labelKey: "processingPlant", href: "/dashboard/processingPlant", capability: "canSendToProcessing" },
      { labelKey: "suppliers", href: "/dashboard/product/suppliers" },
    ],
  },
  {
    titleKey: "attendance",
    items: [
      { labelKey: "analytics", href: "/dashboard/accounts/analytics" },
      { labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out" },
      // Directory hidden until attendance directory data is ready.
      // { labelKey: "directory", href: "/dashboard/accounts/directory" },
    ],
  },
];

/** Outlet-scoped manager tier: same links as Highland plant scope (plan allowlist). */
const outletScopedManagerMenuSections = highlandPlantMenuSections;

const outletStaffDrawerSections: MenuSectionBlock[] = [
  {
    titleKey: "salesBilling",
    items: [
      { labelKey: "pointOfSale", href: "/dashboard/invoices/new", capability: "canCreateProcessedSales" },
      { labelKey: "wasteSales", href: "/dashboard/invoices/waste-sales", capability: "canCreateProcessedSales" },
      { labelKey: "transactions", href: "/dashboard/invoices/transaction", capability: "canViewTransactions" },
      { labelKey: "customers", href: "/dashboard/invoices/customers", capability: "canViewTransactions" },
    ],
  },
  {
    titleKey: "product",
    items: [
      { labelKey: "processedProductsOutlet", href: "/dashboard/product", capability: "canViewInventory" },
      { labelKey: "live", href: "/dashboard/product/liveProduct", capability: "canViewLivestockInventory" },
      { labelKey: "processed", href: "/dashboard/product/processedProduct", capability: "canViewProcessedInventory" },
      { labelKey: "wasteProducts", href: "/dashboard/product/wasteProduct", capability: "canViewProcessedInventory" },
    ],
  },
  {
    titleKey: "attendance",
    items: [{ labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out", capability: "canClockInOut" }],
  },
];

const driverDrawerSections: MenuSectionBlock[] = [
  {
    titleKey: "attendance",
    items: [{ labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out", capability: "canClockInOut" }],
  },
];

const STAFF_HUB_ID = "staff_hub";
const OUTLET_LOGO_HUB_ID = "outlet_logo_hub";

const sidebarConfig = {
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
              { labelKey: "outletExpenses", href: "/dashboard/outlets/expenses", capability: "canViewOutlets" as const },
              { labelKey: "users", href: "/dashboard/users" },
              { labelKey: "departments", href: "/dashboard/departments" },
              // { labelKey: "processingPlant", href: "/dashboard/processingPlant" },
              { labelKey: "roles", href: "/dashboard/accounts/roles" },
              { labelKey: "itemInventory", href: "/dashboard/item-inventory" },
              {
                labelKey: "salesDashboard",
                href: "/dashboard/analytics",
                capability: "canViewSalesAnalytics" as const,
              },
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
                    capability: "canSendToProcessing" as const,
                  },
                ],
              },
              {
                titleKey: "salesBilling",
                items: [
                  { labelKey: "analytics", href: "/dashboard/invoices" },
                  {
                    labelKey: "salesDashboard",
                    href: "/dashboard/analytics",
                    capability: "canViewSalesAnalytics" as const,
                  },
                  {
                    labelKey: "pointOfSale",
                    href: "/dashboard/invoices/new",
                    capability: "canCreateProcessedSales" as const,
                  },
                  {
                    labelKey: "wasteSales",
                    href: "/dashboard/invoices/waste-sales",
                    capability: "canCreateProcessedSales" as const,
                  },
                  {
                    labelKey: "livestockSales",
                    href: "/dashboard/invoices/livestock-sales",
                    capability: "canCreateLivestockSales" as const,
                  },
                  { labelKey: "transactions", href: "/dashboard/invoices/transaction" },
                  { labelKey: "customers", href: "/dashboard/invoices/customers" },
                  { labelKey: "customerTypes", href: "/dashboard/invoices/customer-types" },
                  { labelKey: "loyaltyRules", href: "/dashboard/invoices/loyalty-rules" },
                ],
              },
              {
                titleKey: "product",
                items: [
                  { labelKey: "productType", href: "/dashboard/product/productType", capability: "canCreateProducts" as const },
                  { labelKey: "livestockCategory", href: "/dashboard/product/livestockCategory", capability: "canCreateProducts" as const },
                  { labelKey: "live", href: "/dashboard/product/liveProduct", capability: "canViewLivestockInventory" as const },
                  { labelKey: "processedProductsOutlet", href: "/dashboard/product", capability: "canViewInventory" as const },
                  { labelKey: "processed", href: "/dashboard/product/processedProduct", capability: "canViewProcessedInventory" as const },
                  { labelKey: "wasteProducts", href: "/dashboard/product/wasteProduct", capability: "canViewProcessedInventory" as const },
                  { labelKey: "suppliers", href: "/dashboard/product/suppliers" },
                  { labelKey: "pricelist", href: "/dashboard/dualPricing", capability: "canViewDualPricing" as const },
                ],
              },
              {
                titleKey: "attendance",
                items: [
                  { labelKey: "analytics", href: "/dashboard/accounts/analytics" },
                  { labelKey: "clockInOut", href: "/dashboard/accounts/clock-in-out" },
                  // Directory hidden until attendance directory data is ready.
                  // { labelKey: "directory", href: "/dashboard/accounts/directory" },
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
  capabilities: RoleCapabilities,
  pathname: string,
  locationSearch: string,
  linkForItem: (href: string) => string
): string | null {
  const flat = sections.flatMap((section) =>
    section.items
      .filter((entry) => menuItemIsVisible(entry, canCreate, capabilities))
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
  capabilities: RoleCapabilities,
  openMenuId: string | null
): string | null {
  type Candidate = { id: string; hrefLen: number };
  const candidates: Candidate[] = [];

  for (const item of railItems) {
    const flat = getFlatMenuItems(item.menu as RailMenu);
    const visible = flat.filter(
      (entry) => menuItemIsVisible(entry, canCreate, capabilities)
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
  const queryClient = useQueryClient();
  const location = useLocation();
  const { canCreate, capabilities, hasJwtPermission } = usePermissions();
  const inventoryAccess = useMainOutletInventoryAccess();
  const { userOutletId, userOutletName } = useAuth();
  const { accessTier, lockedOutletId } = useOutletAccess();
  const sessionAccessTier = getAccessTierFromSessionClaims();
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [highlandContext, setHighlandContext] = useState<HighlandStoredContext>(() => {
    const stored = readHighlandContextFromStorage();
    return stored ?? { mode: "main" };
  });

  const sectionRailItems = useMemo(() => {
    if (accessTier === "driver" || accessTier === "outlet_staff") return [];
    const source = accessTier === "outlet_manager"
      ? sidebarConfig.sections[0].items.filter((item) => item.id === "highland")
      : sidebarConfig.sections[0].items;
    const canReadRoles = hasJwtPermission("role:read");
    return source.map((rail) => {
      const menu = rail.menu as RailMenu;
      if (isGroupedRailMenu(menu)) return rail;
      return {
        ...rail,
        menu: {
          ...menu,
          items: menu.items.filter((entry) => {
            if (entry.labelKey === "roles") return canReadRoles;
            if (entry.labelKey === "itemInventory") return inventoryAccess.isAllowed;
            return true;
          }),
        },
      } as SidebarRailItem;
    });
  }, [accessTier, hasJwtPermission, inventoryAccess.isAllowed]);

  const allItems = useMemo(
    () => [...sectionRailItems, ...sidebarConfig.footer.flatMap((section) => section.items)],
    [sectionRailItems]
  );

  const pathname = location.pathname;
  const locationSearch = location.search;

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: sessionAccessTier !== "outlet_staff",
  });

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);

  const visibleSubOutlets = useMemo(() => {
    if ((accessTier === "driver" || accessTier === "outlet_staff") && userOutletId) {
      const outlet = outlets.find((o) => o.id === userOutletId);
      if (outlet) return [outlet];
      return [
        {
          id: userOutletId,
          name: userOutletName?.trim() || "Outlet",
          managerId: "",
          contact: "",
          status: true,
        },
      ];
    }
    if (accessTier === "outlet_manager") return getSubOutletsForScope(outlets);
    if (!userOutletId) return getSubOutletsForScope(outlets);
    /** Main-outlet org users see every plant under scope; other outlet-scoped users see only their outlet. */
    if (mainOutletId != null && userOutletId === mainOutletId) {
      return getSubOutletsForScope(outlets);
    }
    return outlets.filter((o) => o.id === userOutletId);
  }, [accessTier, outlets, userOutletId, userOutletName, mainOutletId]);

  const showSubOutletSwitcher = visibleSubOutlets.length > 0;

  const highlandMainSections = useMemo((): MenuSectionBlock[] => {
    const rail = sidebarConfig.sections[0].items.find((i) => i.id === "highland");
    const menu = rail?.menu as RailMenu | undefined;
    if (menu && isGroupedRailMenu(menu)) return menu.sections;
    return [];
  }, []);

  useEffect(() => {
    const oid = readOutletScopeFromSearch(locationSearch);
    if (!oid) return;
    const sub = visibleSubOutlets.find((o) => o.id === oid);
    if (!sub) return;
    const next: HighlandStoredContext = {
      mode: "plant",
      plantId: sub.id,
      outletId: sub.id,
      plantName: sub.name,
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
  }, [locationSearch, visibleSubOutlets]);

  const primaryRailItems = useMemo(
    () => [...sectionRailItems, ...sidebarConfig.footer.flatMap((section) => section.items)],
    [sectionRailItems]
  );
  const activePrimaryId = useMemo(
    () =>
      getActivePrimaryId(
        pathname,
        locationSearch,
        primaryRailItems,
        canCreate,
        capabilities,
        activeMenuId
      ),
    [pathname, locationSearch, primaryRailItems, canCreate, capabilities, activeMenuId]
  );

  const outletLogoOnlyRail = accessTier === "outlet_staff" || accessTier === "driver";
  const outletLogoRailMenu = useMemo(
    (): RailMenu | null =>
      outletLogoOnlyRail
        ? {
            titleKey: "attendance" as const,
            sections: accessTier === "driver" ? driverDrawerSections : outletStaffDrawerSections,
          }
        : null,
    [accessTier, outletLogoOnlyRail]
  );

  const activeMenu =
    allItems.find((item) => item.id === activeMenuId)?.menu ??
    (activeMenuId === OUTLET_LOGO_HUB_ID ? outletLogoRailMenu : null);
  const activeHrefInOpenMenu = useMemo(() => {
    if (!activeMenu) return null;
    const visible = getFlatMenuItems(activeMenu as RailMenu).filter(
      (entry) => menuItemIsVisible(entry, canCreate, capabilities)
    );
    if (
      (activeMenuId === STAFF_HUB_ID || activeMenuId === OUTLET_LOGO_HUB_ID) &&
      isGroupedRailMenu(activeMenu as RailMenu)
    ) {
      const linkFor = (href: string) =>
        lockedOutletId ? buildPathWithOutletScope(href, lockedOutletId, "") : href;
      return longestActiveDrawerHref(
        accessTier === "driver" ? driverDrawerSections : outletStaffDrawerSections,
        canCreate,
        capabilities,
        pathname,
        locationSearch,
        linkFor
      );
    }
    if (activeMenuId === "highland" && isGroupedRailMenu(activeMenu as RailMenu)) {
      const useScopedPlantMenu =
        (highlandContext.mode === "plant" && Boolean(highlandContext.outletId)) ||
        (accessTier === "outlet_manager" && Boolean(lockedOutletId));
      const sections = useScopedPlantMenu
        ? outletScopedManagerMenuSections
        : highlandMainSections;
      const scopeId =
        lockedOutletId ??
        (highlandContext.mode === "plant" ? highlandContext.outletId : null);
      const linkFor = (href: string) =>
        scopeId ? buildPathWithOutletScope(href, scopeId, "") : href;
      return longestActiveDrawerHref(
        sections,
        canCreate,
        capabilities,
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
    capabilities,
    activeMenuId,
    outletLogoRailMenu,
    highlandContext,
    highlandMainSections,
    accessTier,
    lockedOutletId,
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
      const next = activeMenuId === id ? null : id;
      setActiveMenuId(next);
      if (id === "highland" && next === "highland" && !lockedOutletId) {
        const nextCtx: HighlandStoredContext = { mode: "main" };
        setHighlandContext(nextCtx);
        writeHighlandContextToStorage(nextCtx);
        navigate(buildPathWithOutletScope(pathname, null, locationSearch), {
          replace: true,
        });
      }
    },
    [activeMenuId, navigate, pathname, locationSearch, lockedOutletId]
  );

  const handleLogout = async () => {
    await logoutApi();
    void queryClient.cancelQueries();
    queryClient.clear();
    clearAuthToken();
    clearStoredUser();
    setActiveMenuId(null);
    navigate("/login");
  };

  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [subOutletPickerOpen, setSubOutletPickerOpen] = useState(false);
  /** Grouped drawer (e.g. Highland): which section accordion is expanded. */
  const [groupedDrawerAccordionKey, setGroupedDrawerAccordionKey] =
    useState<TranslationKey | null>(null);

  useLayoutEffect(() => {
    if (!activeMenuId) return;
    const menu = allItems.find((item) => item.id === activeMenuId)?.menu;
    if (!menu || !isGroupedRailMenu(menu as RailMenu)) return;

    const sections =
      activeMenuId === STAFF_HUB_ID || activeMenuId === OUTLET_LOGO_HUB_ID
        ? accessTier === "driver"
          ? driverDrawerSections
          : outletStaffDrawerSections
        : activeMenuId === "highland" &&
            ((highlandContext.mode === "plant" && highlandContext.outletId) ||
              (accessTier === "outlet_manager" && lockedOutletId))
          ? highlandPlantMenuSections
          : (menu as RailMenu & { sections: MenuSectionBlock[] }).sections;
    const visibleBlocks = sections
      .map((section) => ({
        section,
        items: section.items.filter((entry) =>
          menuItemIsVisible(entry, canCreate, capabilities)
        ),
      }))
      .filter((b) => b.items.length > 0);

    const scopeId =
      lockedOutletId ??
      (highlandContext.mode === "plant" ? highlandContext.outletId : null);
    const linkFor = (href: string) =>
      scopeId ? buildPathWithOutletScope(href, scopeId, "") : href;

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
    capabilities,
    activeHrefInOpenMenu,
    allItems,
    highlandContext,
    accessTier,
    lockedOutletId,
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

  const handleSelectSubOutlet = useCallback(
    (subOutlet: Outlet) => {
      setSubOutletPickerOpen(false);
      if (!subOutlet.status) {
        showToast(t("This outlet is inactive."));
        return;
      }
      const nextCtx: HighlandStoredContext = {
        mode: "plant",
        plantId: subOutlet.id,
        outletId: subOutlet.id,
        plantName: subOutlet.name,
      };
      setHighlandContext(nextCtx);
      writeHighlandContextToStorage(nextCtx);
      setActiveMenuId("highland");
      navigate(
        buildPathWithOutletScope(pathname, subOutlet.id, locationSearch),
        { replace: true }
      );
    },
    [locationSearch, navigate, pathname, showToast, t]
  );

  const handleDesktopSubOutletClick = useCallback(
    (subOutlet: Outlet) => {
      if (outletLogoOnlyRail) {
        if (!subOutlet.status) {
          showToast(t("This outlet is inactive."));
          return;
        }
        const nextCtx: HighlandStoredContext = {
          mode: "plant",
          plantId: subOutlet.id,
          outletId: subOutlet.id,
          plantName: subOutlet.name,
        };
        setHighlandContext(nextCtx);
        writeHighlandContextToStorage(nextCtx);
        setActiveMenuId((id) =>
          id === OUTLET_LOGO_HUB_ID ? null : OUTLET_LOGO_HUB_ID
        );
        return;
      }
      handleSelectSubOutlet(subOutlet);
    },
    [handleSelectSubOutlet, outletLogoOnlyRail, showToast, t]
  );

  const subOutletCount = visibleSubOutlets.length;

  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty("--mobile-chrome-bottom");
      return;
    }
    const px = subOutletCount > 0 ? 96 : 56;
    document.documentElement.style.setProperty("--mobile-chrome-bottom", `${px}px`);
    return () => {
      document.documentElement.style.removeProperty("--mobile-chrome-bottom");
    };
  }, [isMobile, subOutletCount]);

  const activeSubOutlet = useMemo(
    () =>
      highlandContext.mode === "plant" && highlandContext.plantId
        ? visibleSubOutlets.find((o) => o.id === highlandContext.plantId) ?? null
        : null,
    [highlandContext.mode, highlandContext.plantId, visibleSubOutlets]
  );
  const hasUsableSubOutlet = useMemo(
    () => visibleSubOutlets.some((o) => o.status),
    [visibleSubOutlets]
  );
  const singleSubOutlet = subOutletCount === 1 ? visibleSubOutlets[0] : null;

  const handleSubOutletHubClick = useCallback(() => {
    if (!hasUsableSubOutlet) {
      showToast(t("No active sub-outlets available."));
      return;
    }
    if (subOutletCount === 1) {
      if (singleSubOutlet) {
        void handleSelectSubOutlet(singleSubOutlet);
      }
      return;
    }
    setSubOutletPickerOpen((o) => !o);
  }, [
    hasUsableSubOutlet,
    handleSelectSubOutlet,
    showToast,
    subOutletCount,
    singleSubOutlet,
    t,
  ]);

  useEffect(() => {
    if (!isMobile) setSubOutletPickerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (subOutletCount === 0) setSubOutletPickerOpen(false);
  }, [subOutletCount]);

  useEffect(() => {
    if (activeMenuId != null) setSubOutletPickerOpen(false);
  }, [activeMenuId]);

  useEffect(() => {
    if (!subOutletPickerOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSubOutletPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subOutletPickerOpen]);

  const mobileScopeOutletId =
    accessTier === "outlet_staff"
      ? null
      : lockedOutletId ??
        (highlandContext.mode === "plant" && highlandContext.outletId
          ? highlandContext.outletId
          : null);

  return (
    <div className="sidebarWrapper">
      {!isMobile ? (
      <aside className="sidebar" aria-label="Primary">
        <div className="header">
          <img
            src={squareLogo}
            alt="Highland Meat Processing"
            className="sidebarLogo"
          />
        </div>

        <nav className="nav">
          <div key="primary-rail">
            {sectionRailItems.map((item) => {
              const isHighland = item.id === "highland";
              const railActive =
                activePrimaryId === item.id &&
                (!isHighland || highlandContext.mode === "main");
              const label = getSidebarLabel(item.menu.titleKey);
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={railActive ? "link active" : "link"}
                      type="button"
                      aria-label={label}
                      aria-pressed={activeMenuId === item.id}
                      onClick={() => handleMenuToggle(item.id)}
                    >
                      <span className="mobileRailIcon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="mobileRailLabel">{label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {showSubOutletSwitcher && subOutletCount > 0 && (
            <div
              className="subOutletRailTrack"
              role="group"
              aria-label={t("Sub-outlet switcher")}
            >
              {visibleSubOutlets.map((subOutlet) => {
                const canSelect = subOutlet.status;
                const isActiveSub =
                  highlandContext.mode === "plant" &&
                  highlandContext.plantId === subOutlet.id;
                const tooltipLabel = canSelect
                  ? subOutlet.name
                  : t("This outlet is inactive.");
                return (
                  <Tooltip key={`sub-outlet-${subOutlet.id}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={
                          isActiveSub
                            ? "link subOutletRail active"
                            : "link subOutletRail"
                        }
                        disabled={!canSelect}
                        aria-label={subOutlet.name}
                        aria-pressed={isActiveSub}
                        onClick={() => handleDesktopSubOutletClick(subOutlet)}
                      >
                        <span
                          className="mobileRailIcon plantRailBadge"
                          aria-hidden
                        >
                          {twoLetterLabelFromPlantName(subOutlet.name)}
                        </span>
                        <span className="mobileRailLabel">{subOutlet.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{tooltipLabel}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </nav>

        {!outletLogoOnlyRail && (
        <div className="footer">
          <LanguageToggle className="link" />
          {showInstallButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="link"
                  onClick={handleInstallClick}
                  aria-label={t("Install App")}
                >
                  <span className="mobileRailIcon" aria-hidden>
                    <LuDownload size={20} />
                  </span>
                  <span className="mobileRailLabel">{t("Install")}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("Install App")}</TooltipContent>
            </Tooltip>
          )}
          {sidebarConfig.footer[0].items
            .filter((item) => !isMobile || item.id !== "settings")
            .map((item) => {
              const label = getSidebarLabel(item.menu.titleKey);
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={
                        activePrimaryId === item.id ? "link active" : "link"
                      }
                      type="button"
                      aria-label={label}
                      aria-pressed={activeMenuId === item.id}
                      onClick={() => handleMenuToggle(item.id)}
                    >
                      <span className="mobileRailIcon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="mobileRailLabel">{label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
        </div>
        )}
      </aside>
      ) : (
        <div className="mobileBottomChrome">
          {showSubOutletSwitcher && subOutletCount > 0 ? (
            <div className="mobilePlantStrip" role="toolbar" aria-label={t("Sub-outlets")}>
              <button
                type="button"
                className={[
                  "mobilePlantStrip__btn",
                  (highlandContext.mode === "plant" && activeSubOutlet) || subOutletPickerOpen
                    ? "mobilePlantStrip__btn--active"
                    : "",
                  subOutletPickerOpen ? "mobilePlantStrip__btn--open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  subOutletCount > 1
                    ? t("Sub-outlets")
                    : singleSubOutlet?.name ?? t("Sub-outlets")
                }
                disabled={!hasUsableSubOutlet}
                aria-label={t("Sub-outlets")}
                aria-haspopup={subOutletCount > 1 ? "dialog" : undefined}
                aria-expanded={subOutletCount > 1 ? subOutletPickerOpen : undefined}
                aria-controls={subOutletCount > 1 ? "sub-outlet-picker" : undefined}
                onClick={handleSubOutletHubClick}
              >
                <span className="mobilePlantStrip__icon" aria-hidden>
                  {subOutletCount === 1 && singleSubOutlet ? (
                    <span className="plantRailBadge">
                      {twoLetterLabelFromPlantName(singleSubOutlet.name)}
                    </span>
                  ) : activeSubOutlet ? (
                    <span className="plantRailBadge">
                      {twoLetterLabelFromPlantName(activeSubOutlet.name)}
                    </span>
                  ) : (
                    <TbBuildingFactory2 size={18} />
                  )}
                </span>
                <span className="mobilePlantStrip__label">
                  {activeSubOutlet?.name ??
                    singleSubOutlet?.name ??
                    t("Sub-outlets")}
                </span>
              </button>
            </div>
          ) : null}
          <MobileBottomNav
            scopedOutletId={mobileScopeOutletId}
            accessTier={accessTier}
            lockedOutletId={lockedOutletId}
          />
        </div>
      )}

      {isMobile && showSubOutletSwitcher && subOutletCount > 1 && (
        <Sheet
          open={subOutletPickerOpen}
          onOpenChange={setSubOutletPickerOpen}
        >
          <SheetContent
            side="bottom"
            id="sub-outlet-picker"
            aria-label={t("Sub-outlets")}
            className="rounded-t-2xl border-t pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">{t("Sub-outlets")}</SheetTitle>
            </SheetHeader>
            <ul
              className="mt-2 flex max-h-[60vh] flex-col gap-1 overflow-y-auto"
              role="listbox"
              aria-label={t("Sub-outlets")}
            >
              {visibleSubOutlets.map((subOutlet) => {
                const canSelect = subOutlet.status;
                const isActive =
                  highlandContext.mode === "plant" &&
                  highlandContext.plantId === subOutlet.id;
                return (
                  <li key={subOutlet.id}>
                    <button
                      type="button"
                      className={
                        isActive
                          ? "subOutletPickerItemBtn active"
                          : "subOutletPickerItemBtn"
                      }
                      role="option"
                      aria-selected={isActive}
                      disabled={!canSelect}
                      title={
                        canSelect
                          ? subOutlet.name
                          : t("This outlet is inactive.")
                      }
                      onClick={() => handleSelectSubOutlet(subOutlet)}
                    >
                      <span className="subOutletPickerItemBadge" aria-hidden>
                        {twoLetterLabelFromPlantName(subOutlet.name)}
                      </span>
                      <span className="subOutletPickerItemName">
                        {subOutlet.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SheetContent>
        </Sheet>
      )}

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setActiveMenuId(null)}
            aria-label={t("Close menu")}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="drawerBody">
          {activeMenu &&
            (isGroupedRailMenu(activeMenu as RailMenu) ? (
              <Accordion
                type="single"
                collapsible
                value={groupedDrawerAccordionKey ?? ""}
                onValueChange={(v) =>
                  setGroupedDrawerAccordionKey(
                    v ? (v as TranslationKey) : null,
                  )
                }
                className="flex flex-col gap-1.5"
              >
                {(() => {
                  if (
                    activeMenuId === STAFF_HUB_ID ||
                    activeMenuId === OUTLET_LOGO_HUB_ID
                  ) {
                    return accessTier === "driver"
                      ? driverDrawerSections
                      : outletStaffDrawerSections;
                  }
                  const useScopedPlantMenu =
                    activeMenuId === "highland" &&
                    ((highlandContext.mode === "plant" &&
                      highlandContext.outletId) ||
                      (accessTier === "outlet_manager" &&
                        Boolean(lockedOutletId)));
                  if (useScopedPlantMenu) return highlandPlantMenuSections;
                  return (
                    activeMenu as RailMenu & { sections: MenuSectionBlock[] }
                  ).sections;
                })().map((section) => {
                  const visibleItems = section.items.filter((entry) =>
                    menuItemIsVisible(entry, canCreate, capabilities),
                  );
                  if (visibleItems.length === 0) return null;

                  return (
                    <AccordionItem
                      key={section.titleKey}
                      value={section.titleKey}
                      className="overflow-hidden rounded-lg border border-border bg-muted/40"
                    >
                      <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground hover:no-underline hover:bg-muted">
                        {getSidebarLabel(section.titleKey)}
                      </AccordionTrigger>
                      <AccordionContent className="border-t border-border bg-card px-1.5 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          {visibleItems.map((entry) => {
                            const scopeId =
                              lockedOutletId ??
                              (highlandContext.mode === "plant"
                                ? highlandContext.outletId
                                : null);
                            const to = scopeId
                              ? buildPathWithOutletScope(entry.href, scopeId, "")
                              : entry.href;
                            const isActive = drawerLinkIsActive(
                              to,
                              pathname,
                              locationSearch,
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
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              (activeMenu as { items: MenuItem[] }).items
                .filter((entry) =>
                  menuItemIsVisible(entry, canCreate, capabilities),
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
                ))
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


