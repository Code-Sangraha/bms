"use client";

import { useQuery } from "@tanstack/react-query";
import { type ComponentType, useMemo, useState } from "react";
import {
  LuArrowRight,
  LuBanknote,
  LuBoxes,
  LuClipboardList,
  LuCreditCard,
  LuPackage,
  LuReceiptText,
  LuScale,
  LuStore,
  LuUsers,
  LuWallet,
} from "react-icons/lu";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { useOutletScope } from "@/app/providers/OutletScopeProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { getAttendanceAnalytics } from "@/handlers/attendance";
import { getEmployees } from "@/handlers/employee";
import { getProducts, getLivestockExpenseHistory, type Product } from "@/handlers/product";
import type { LivestockExpenseHistoryEntry } from "@/lib/api/livestockExpenseHistory";
import { getProductTypes } from "@/handlers/productType";
import { getMainOutletId, getOutlets } from "@/handlers/outlet";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import {
  getDashboardSales,
  getLivestockSales,
  LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT,
  getSales,
  type DashboardSalesData,
  type LivestockSale,
  type SaleTransaction,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import {
  CardGridSkeleton,
  TableSkeleton,
} from "@/app/components/ui-ext/LoadingState";
import "./dashboard.scss";
import DashboardMobileHome, { type CashflowDay } from "./components/DashboardMobileHome";
import LivestockCompletePartialPaymentModal from "./product/liveProduct/LivestockCompletePartialPaymentModal";
import ExpenseRecordPaymentButton from "./shared/ExpenseRecordPaymentButton";
import { canRecordExpensePayment } from "@/lib/billing/expensePaymentUi";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
/** Up to LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT rows for aggregates (pagination on list endpoints). */
const LIVESTOCK_SALES_SUMMARY_QUERY_KEY = ["livestockSales", "summary"];
const SALES_QUERY_KEY = ["sales"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const OUTLETS_QUERY_KEY = ["outlets"];
const LIVESTOCK_EXPENSE_DASHBOARD_QUERY_KEY = ["livestockExpenseHistory", "dashboard"];
const DASHBOARD_ATTENDANCE_QUERY_KEY = ["attendanceAnalytics", "dashboard", "day"];
const EMPLOYEES_QUERY_KEY = ["employees"];
const DASHBOARD_EXPENSE_ROW_LIMIT = 20;

function formatDashboardAttendanceHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

type DashboardMetricCardProps = {
  label: string;
  value: string;
  sub?: string;
  toneClassName?: string;
  icon: ComponentType<{ className?: string }>;
};

type ProcessedLineItem = {
  transactionId: string;
  customerName: string;
  contact: string;
  type: string;
  productId: string;
  productName: string;
  outletId: string;
  outletName: string;
  amount: number;
  weight: number;
  quantity: number;
  date: string;
};

function resolveSaleOutletId(tx: SaleTransaction): string {
  const nested = tx.outlet && typeof tx.outlet.id === "string" ? tx.outlet.id : "";
  return String(tx.outletId ?? nested).trim();
}

function formatDashboardExpenseDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString();
}

function truncateToTwoDecimals(value: number): number {
  return Math.trunc(value * 100) / 100;
}

function formatDashboardMoney(value: number): string {
  if (!Number.isFinite(value)) return "Rs.0.00";
  return `Rs.${truncateToTwoDecimals(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDashboardDecimal(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = truncateToTwoDecimals(value).toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

function expensePaymentStatusLabel(
  status: LivestockExpenseHistoryEntry["paymentStatus"],
  t: (key: string) => string
): string {
  switch (status) {
    case "ADVANCE":
      return t("Advance");
    case "PARTIAL":
      return t("Partial");
    case "FULL":
      return t("Full");
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function DashboardMetricCard({
  label,
  value,
  sub,
  toneClassName,
  icon: Icon,
}: DashboardMetricCardProps) {
  const compactValueClass =
    value.length > 18
      ? " dashboardCardValueLong"
      : value.length > 13
        ? " dashboardCardValueCompact"
        : "";

  return (
    <div className={`dashboardCard ${toneClassName ?? ""}`.trim()}>
      <div className="dashboardCardTop">
        <span className="dashboardCardLabel">{label}</span>
        <span className="dashboardCardIcon" aria-hidden="true">
          <Icon className="dashboardCardIconSvg" />
        </span>
      </div>
      <span className={`dashboardCardValue${compactValueClass}`}>{value}</span>
      {sub ? <span className="dashboardCardSub">{sub}</span> : null}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { t } = useI18n();
  const { isScoped, scopedOutletId } = useOutletScope();
  const { rowFilterOutletId } = useRowFilterOutletId();
  const { accessTier, lockedOutletId } = useOutletAccess();
  const { userOutletId } = useAuth();
  const { capabilities } = usePermissions();
  const [expenseToPay, setExpenseToPay] = useState<LivestockExpenseHistoryEntry | null>(null);
  const canRecordPayment = capabilities.canRestockLivestockInventory;
  const canShowAttendance = capabilities.canViewAttendance;

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const mainOutletId = useMemo(() => getMainOutletId(outlets), [outlets]);
  const effectiveOutletScopeId = useMemo(() => {
    if (rowFilterOutletId) return rowFilterOutletId;
    if (lockedOutletId) return lockedOutletId;
    if (accessTier === "global") return null;
    if (!userOutletId) return null;
    return mainOutletId && userOutletId === mainOutletId ? null : userOutletId;
  }, [accessTier, lockedOutletId, mainOutletId, rowFilterOutletId, userOutletId]);

  const { data: employees = [] } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: async () => {
      const result = await getEmployees();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: canShowAttendance,
  });

  const {
    data: dayAttendanceRows = [],
    isLoading: dayAttendanceLoading,
  } = useQuery({
    queryKey: [...DASHBOARD_ATTENDANCE_QUERY_KEY, effectiveOutletScopeId ?? "all"],
    queryFn: async () => {
      const result = await getAttendanceAnalytics({
        outletId: effectiveOutletScopeId,
        period: "day",
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      const list = result.data.data ?? [];
      return Array.isArray(list) ? list : [];
    },
    enabled: canShowAttendance,
  });

  const isOutletScopedDashboard = Boolean(effectiveOutletScopeId);
  const canShowUnscopedLivestock = !isOutletScopedDashboard;
  const showTopOutlets = !isOutletScopedDashboard;

  const { data: salesResponse } = useQuery({
    queryKey: DASHBOARD_SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getDashboardSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: livestockSales = [],
    isLoading: livestockSalesLoading,
    isError: livestockSalesError,
    error: livestockSalesErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_SALES_SUMMARY_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockSales({
        page: 1,
        limit: LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT,
      });
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data.rows;
    },
    enabled: canShowUnscopedLivestock,
  });

  const {
    data: salesTransactions = [],
    isLoading: salesTransactionsLoading,
    isError: salesTransactionsError,
    error: salesTransactionsErrorDetail,
  } = useQuery({
    queryKey: SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: livestockExpenseRows = [],
    isLoading: livestockExpenseLoading,
    isError: livestockExpenseError,
    error: livestockExpenseErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_EXPENSE_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockExpenseHistory({});
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const dashboardExpenseRows = useMemo(
    () => livestockExpenseRows.slice(0, DASHBOARD_EXPENSE_ROW_LIMIT),
    [livestockExpenseRows]
  );

  const scopedSalesTransactions = useMemo(() => {
    if (!effectiveOutletScopeId) return salesTransactions;
    return (salesTransactions as SaleTransaction[]).filter(
      (tx) => resolveSaleOutletId(tx) === effectiveOutletScopeId
    );
  }, [effectiveOutletScopeId, salesTransactions]);

  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    error: productsErrorDetail,
  } = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const result = await getProducts();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    data: productTypes = [],
    isLoading: productTypesLoading,
    isError: productTypesError,
    error: productTypesErrorDetail,
  } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const salesLoading = salesTransactionsLoading || productsLoading || productTypesLoading;
  const salesError = salesTransactionsError || productsError || productTypesError;
  const salesErrorDetail =
    salesTransactionsErrorDetail ?? productsErrorDetail ?? productTypesErrorDetail;

  const salesData: DashboardSalesData | undefined = salesResponse?.data;
  const dashboardSalesByOutlet = salesData?.salesByOutlet ?? [];
  const dashboardSalesByProduct = salesData?.salesByProduct ?? [];
  const dashboardSalesByCustomer = salesData?.salesByCustomer ?? [];

  const processedTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (pt.name?.toLowerCase() === "processed") ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const processedProductIdSet = useMemo(() => {
    const ids = new Set<string>();
    products.forEach((product: Product) => {
      if (processedTypeIds.has(product.productTypeId)) ids.add(product.id);
    });
    return ids;
  }, [products, processedTypeIds]);

  const processedProductNameSet = useMemo(() => {
    const names = new Set<string>();
    products.forEach((product: Product) => {
      if (processedTypeIds.has(product.productTypeId)) names.add(product.name.toLowerCase());
    });
    return names;
  }, [products, processedTypeIds]);

  const processedLineItems = useMemo<ProcessedLineItem[]>(() => {
    const toNumber = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };

    const rows: ProcessedLineItem[] = [];

    for (const tx of scopedSalesTransactions as SaleTransaction[]) {
      const items = Array.isArray(tx.items) ? tx.items : [];
      const txCustomer =
        (typeof tx.name === "string" && tx.name) ||
        (typeof tx.customer === "object" && tx.customer && typeof tx.customer.name === "string"
          ? tx.customer.name
          : t("Unknown customer"));
      const txContact = typeof tx.contact === "string" ? tx.contact : "-";
      const txDate =
        (typeof tx.createdAt === "string" && tx.createdAt) ||
        (typeof tx.date === "string" && tx.date) ||
        "";
      const txId = tx.transactionId ?? tx.id;

      for (const item of items) {
        const productObj = item.product as { id?: unknown; name?: unknown } | undefined;
        const productId = typeof productObj?.id === "string" ? productObj.id : "";
        const productName = typeof productObj?.name === "string" ? productObj.name : "";
        const isProcessed =
          processedProductIdSet.has(productId) ||
          processedProductNameSet.has(productName.toLowerCase());
        if (!isProcessed) continue;

        const itemAmount = toNumber((item as { amount?: unknown }).amount);
        const itemWeight = toNumber((item as { weight?: unknown }).weight);
        const itemQuantity = toNumber((item as { quantity?: unknown }).quantity);
        const resolvedName = productName || t("Unknown product");
        const typeName =
          typeof item.customerType === "object" && item.customerType && typeof item.customerType.name === "string"
            ? item.customerType.name
            : typeof tx.type === "string"
              ? tx.type
              : t("Unknown");
        rows.push({
          transactionId: txId,
          customerName: txCustomer,
          contact: txContact,
          type: typeName,
          productId,
          productName: resolvedName,
          outletId: resolveSaleOutletId(tx),
          outletName:
            tx.outlet && typeof tx.outlet.name === "string" && tx.outlet.name.trim()
              ? tx.outlet.name.trim()
              : resolveSaleOutletId(tx),
          amount: itemAmount,
          weight: itemWeight,
          quantity: itemQuantity,
          date: txDate,
        });
      }
    }

    return rows;
  }, [scopedSalesTransactions, processedProductIdSet, processedProductNameSet, t]);

  const getLivestockDisplay = (sale: LivestockSale): string => {
    const id = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
    const firstItem =
      Array.isArray(sale.items) && sale.items.length > 0 && typeof sale.items[0] === "object"
        ? (sale.items[0] as Record<string, unknown>)
        : null;
    const livestockItemObj =
      firstItem && typeof firstItem.livestockItem === "object"
        ? (firstItem.livestockItem as Record<string, unknown>)
        : null;
    const itemId =
      (typeof livestockItemObj?.itemId === "string" && livestockItemObj.itemId) ||
      (typeof firstItem?.itemId === "string" && firstItem.itemId) ||
      "";
    const itemName =
      (typeof livestockItemObj?.name === "string" && livestockItemObj.name) ||
      (typeof firstItem?.name === "string" && firstItem.name) ||
      "";

    if (itemId || itemName) return [itemId, itemName].filter(Boolean).join(" - ");
    return id || "-";
  };

  const dashboardLivestockSales = useMemo(
    () => (canShowUnscopedLivestock ? livestockSales : []),
    [canShowUnscopedLivestock, livestockSales]
  );

  const livestockRevenue = dashboardLivestockSales.reduce(
    (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
    0
  );
  const livestockWeight = dashboardLivestockSales.reduce(
    (sum, row) =>
      sum +
      (typeof row.weight === "number"
        ? row.weight
        : typeof row.itemQuantityOrWeight === "number"
          ? row.itemQuantityOrWeight
          : typeof row.quantity === "number"
            ? row.quantity
            : 0),
    0
  );
  const livestockQuantity = dashboardLivestockSales.reduce(
    (sum, row) =>
      sum +
      (typeof row.quantity === "number"
        ? row.quantity
        : typeof row.itemQuantityOrWeight === "number"
          ? row.itemQuantityOrWeight
          : 1),
    0
  );
  const livestockTransactions = dashboardLivestockSales.length;

  const processedTransactions = useMemo(
    () => new Set(processedLineItems.map((row) => row.transactionId)).size,
    [processedLineItems]
  );
  const processedRevenue = useMemo(
    () => processedLineItems.reduce((sum, row) => sum + row.amount, 0),
    [processedLineItems]
  );
  const processedWeight = useMemo(
    () => processedLineItems.reduce((sum, row) => sum + row.weight, 0),
    [processedLineItems]
  );
  const processedQuantity = useMemo(
    () => processedLineItems.reduce((sum, row) => sum + row.quantity, 0),
    [processedLineItems]
  );
  const processedProductsSold = useMemo(() => {
    const byItem = new Map<string, { name: string; revenue: number; weight: number; quantity: number }>();
    for (const row of processedLineItems) {
      const key = row.productName.toLowerCase();
      const prev = byItem.get(key);
      if (!prev) {
        byItem.set(key, {
          name: row.productName,
          revenue: row.amount,
          weight: row.weight,
          quantity: row.quantity,
        });
      } else {
        prev.revenue += row.amount;
        prev.weight += row.weight;
        prev.quantity += row.quantity;
      }
    }
    return Array.from(byItem.values()).sort((a, b) => b.revenue - a.revenue);
  }, [processedLineItems]);
  const processedRows = useMemo(
    () =>
      [...processedLineItems]
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, 12),
    [processedLineItems]
  );

  const derivedSalesByOutlet = useMemo<SalesByOutletItem[]>(() => {
    if (isOutletScopedDashboard) return [];
    const outletNames = new Map(outlets.map((outlet) => [outlet.id, outlet.name]));
    const byOutlet = new Map<string, SalesByOutletItem>();
    for (const row of processedLineItems) {
      if (!row.outletId) continue;
      const prev = byOutlet.get(row.outletId);
      if (!prev) {
        byOutlet.set(row.outletId, {
          outletId: row.outletId,
          outletName: outletNames.get(row.outletId) ?? (row.outletName || row.outletId),
          totalAmount: row.amount,
        });
      } else {
        prev.totalAmount += row.amount;
      }
    }
    return Array.from(byOutlet.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);
  }, [isOutletScopedDashboard, outlets, processedLineItems]);

  const derivedSalesByProduct = useMemo<SalesByProductItem[]>(() => {
    const byProduct = new Map<string, SalesByProductItem>();
    for (const row of processedLineItems) {
      const key = row.productId || row.productName.toLowerCase();
      const prev = byProduct.get(key);
      if (!prev) {
        byProduct.set(key, {
          productId: row.productId || key,
          productName: row.productName,
          totalAmount: row.amount,
          totalQuantity: row.quantity,
          totalWeight: row.weight,
        });
      } else {
        prev.totalAmount += row.amount;
        prev.totalQuantity += row.quantity;
        prev.totalWeight += row.weight;
      }
    }
    return Array.from(byProduct.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);
  }, [processedLineItems]);

  const derivedSalesByCustomer = useMemo<SalesByCustomerItem[]>(() => {
    const byCustomer = new Map<string, SalesByCustomerItem>();
    for (const row of processedLineItems) {
      const key = row.customerName.trim().toLowerCase() || "unknown";
      const prev = byCustomer.get(key);
      if (!prev) {
        byCustomer.set(key, {
          customerName: row.customerName,
          totalAmount: row.amount,
          totalQuantity: row.quantity,
          totalWeight: row.weight,
        });
      } else {
        prev.totalAmount += row.amount;
        prev.totalQuantity += row.quantity;
        prev.totalWeight += row.weight;
      }
    }
    return Array.from(byCustomer.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);
  }, [processedLineItems]);

  const salesByOutlet = derivedSalesByOutlet.length > 0
    ? derivedSalesByOutlet
    : showTopOutlets
      ? dashboardSalesByOutlet.slice(0, 5)
      : [];
  const salesByProduct = derivedSalesByProduct.length > 0
    ? derivedSalesByProduct
    : isOutletScopedDashboard
      ? []
      : dashboardSalesByProduct.slice(0, 5);
  const salesByCustomer = derivedSalesByCustomer.length > 0
    ? derivedSalesByCustomer
    : isOutletScopedDashboard
      ? []
      : dashboardSalesByCustomer.slice(0, 5);

  const dailySalesRows = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const toDateKey = (value: string): string => {
      const d = new Date(value);
      if (!Number.isFinite(d.getTime())) return "";
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const daily = new Map<
      string,
      { dateKey: string; revenue: number; weight: number; quantity: number; txIds: Set<string> }
    >();

    for (const row of processedLineItems) {
      const key = toDateKey(row.date);
      if (!key) continue;
      const current = daily.get(key) ?? {
        dateKey: key,
        revenue: 0,
        weight: 0,
        quantity: 0,
        txIds: new Set<string>(),
      };
      current.revenue += row.amount || 0;
      current.weight += row.weight || 0;
      current.quantity += row.quantity || 0;
      current.txIds.add(`p-${row.transactionId}`);
      daily.set(key, current);
    }

    for (const row of dashboardLivestockSales) {
      const dateValue =
        (typeof row.createdAt === "string" && row.createdAt) ||
        (typeof row.date === "string" && row.date) ||
        "";
      const key = toDateKey(dateValue);
      if (!key) continue;
      const current = daily.get(key) ?? {
        dateKey: key,
        revenue: 0,
        weight: 0,
        quantity: 0,
        txIds: new Set<string>(),
      };
      const amount = typeof row.amount === "number" ? row.amount : 0;
      const weight =
        typeof row.weight === "number"
          ? row.weight
          : typeof row.itemQuantityOrWeight === "number"
            ? row.itemQuantityOrWeight
            : typeof row.quantity === "number"
              ? row.quantity
              : 0;
      const quantity =
        typeof row.quantity === "number"
          ? row.quantity
          : typeof row.itemQuantityOrWeight === "number"
            ? row.itemQuantityOrWeight
            : 1;
      current.revenue += amount;
      current.weight += weight;
      current.quantity += quantity;
      current.txIds.add(`l-${row.id ?? row.transactionId ?? key}`);
      daily.set(key, current);
    }

    return Array.from(daily.values())
      .map((d) => ({
        dateKey: d.dateKey,
        revenue: d.revenue,
        transactions: d.txIds.size,
        weight: d.weight,
        quantity: d.quantity,
      }))
      .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
      .slice(0, 10);
  }, [processedLineItems, dashboardLivestockSales]);

  const cashflowLast7Days = useMemo((): CashflowDay[] => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const toKeyFromString = (value: string): string | null => {
      const dt = new Date(value);
      if (!Number.isFinite(dt.getTime())) return null;
      return toDateKey(dt);
    };

    const map = new Map<string, number>();

    for (const row of processedLineItems) {
      const k = toKeyFromString(row.date);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + (row.amount || 0));
    }
    for (const row of dashboardLivestockSales) {
      const raw =
        (typeof row.createdAt === "string" && row.createdAt) ||
        (typeof row.date === "string" && row.date) ||
        "";
      const k = toKeyFromString(raw);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + (typeof row.amount === "number" ? row.amount : 0));
    }

    const days: CashflowDay[] = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = toDateKey(d);
      days.push({
        dateKey,
        label: toLabel(d),
        moneyIn: map.get(dateKey) ?? 0,
        moneyOut: 0,
      });
    }
    return days;
  }, [processedLineItems, dashboardLivestockSales]);

  const totalRevenue = processedRevenue + livestockRevenue;
  const totalTransactions = processedTransactions + livestockTransactions;
  const totalWeight = processedWeight + livestockWeight;
  const totalQuantity = processedQuantity + livestockQuantity;
  const totalExpenses = livestockExpenseRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const totalExpensePaid = livestockExpenseRows.reduce((sum, row) => sum + row.paidAmount, 0);
  const totalExpenseDue = livestockExpenseRows.reduce((sum, row) => sum + row.dueAmount, 0);

  const livestockSalesRows = [...dashboardLivestockSales]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

  const maxOutletAmount = Math.max(...salesByOutlet.map((o) => o.totalAmount ?? 0), 1);
  const salesMetricCards = [
    {
      label: t("Total Revenue"),
      value: formatDashboardMoney(totalRevenue),
      icon: LuWallet,
      toneClassName: "dashboardCardRevenue",
    },
    {
      label: t("Transactions"),
      value: String(totalTransactions),
      icon: LuReceiptText,
      toneClassName: "dashboardCardTransactions",
    },
    {
      label: t("Weight Sold"),
      value: `${formatDashboardDecimal(totalWeight)} kg`,
      icon: LuScale,
      toneClassName: "dashboardCardWeight",
    },
    {
      label: t("Quantity Sold"),
      value: formatDashboardDecimal(totalQuantity),
      icon: LuBoxes,
      toneClassName: "dashboardCardQuantity",
    },
  ];
  const expenseMetricCards = [
    {
      label: t("Total amount"),
      value: formatDashboardMoney(totalExpenses),
      icon: LuBanknote,
      toneClassName: "dashboardCardTransactions",
    },
    {
      label: t("Paid amount"),
      value: formatDashboardMoney(totalExpensePaid),
      icon: LuCreditCard,
      toneClassName: "dashboardCardRevenue",
    },
    {
      label: t("Due amount"),
      value: formatDashboardMoney(totalExpenseDue),
      icon: LuWallet,
      toneClassName: "dashboardCardQuantity",
    },
    {
      label: t("Records"),
      value: String(livestockExpenseRows.length),
      icon: LuReceiptText,
      toneClassName: "dashboardCardWeight",
    },
  ];
  const attendanceMetricCards = useMemo(() => {
    const staffInScope = effectiveOutletScopeId
      ? employees.filter((e) => e.outletId === effectiveOutletScopeId)
      : employees;
    const totalStaff = staffInScope.length;
    const presentToday = dayAttendanceRows.filter((r) => r.presentDays > 0).length;
    const pct =
      totalStaff > 0 ? Math.round((presentToday / totalStaff) * 100) : 0;
    const totalHours = dayAttendanceRows.reduce(
      (sum, r) => sum + (r.totalHoursWorked ?? 0),
      0
    );

    return [
      {
        label: t("Total Staff"),
        value: dayAttendanceLoading ? "—" : String(totalStaff),
        sub: effectiveOutletScopeId
          ? t("In selected outlet")
          : `${outlets.length} ${t("Outlets")}`,
        icon: LuUsers,
        toneClassName: "dashboardCardStaff",
      },
      {
        label: t("Active in period"),
        value: dayAttendanceLoading ? "—" : String(presentToday),
        sub: totalStaff > 0 ? `${pct}% · ${t("Last 24 hours")}` : t("Last 24 hours"),
        icon: LuClipboardList,
        toneClassName: "dashboardCardPresent",
      },
      {
        label: t("Total hours"),
        value: dayAttendanceLoading ? "—" : formatDashboardAttendanceHours(totalHours),
        sub: t("Last 24 hours"),
        icon: LuScale,
        toneClassName: "dashboardCardWeight",
      },
    ];
  }, [
    dayAttendanceLoading,
    dayAttendanceRows,
    effectiveOutletScopeId,
    employees,
    outlets.length,
    t,
  ]);

  const dashboardAttendanceTableRows = useMemo(() => {
    return dayAttendanceRows
      .slice()
      .sort((a, b) => b.totalHoursWorked - a.totalHoursWorked)
      .slice(0, 8)
      .map((row) => ({
        id: `${row.type}-${row.id}`,
        name: row.name,
        sessions: row.presentDays,
        hours: formatDashboardAttendanceHours(row.totalHoursWorked),
        status: row.presentDays > 0 ? ("Present" as const) : ("Absent" as const),
      }));
  }, [dayAttendanceRows]);

  return (
    <>
    <section className="dashboardOverview">
      <DashboardMobileHome
        t={t}
        scopedOutletId={isScoped && scopedOutletId ? scopedOutletId : null}
        search={search}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        totalExpenseDue={totalExpenseDue}
        totalTransactions={totalTransactions}
        cashflowDays={cashflowLast7Days}
        canCreate={capabilities.canCreateProcessedSales}
        outletScopedMobile={isOutletScopedDashboard && !capabilities.canCreateLivestockSales}
      />
      <div className="dashboardHero dashboardHero--hideOnMobile">
        <h1 className="dashboardTitle">{t("Dashboard")}</h1>
        <p className="dashboardSubtitle">{t("Sales, billing and attendance at a glance.")}</p>
      </div>

      {/* Sales & Billing */}
      <div className="dashboardSection dashboardSectionSales">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Sales & Billing")}</h2>
          <Link
            to={buildPathWithOutletScope(
              "/dashboard/invoices",
              isScoped && scopedOutletId ? scopedOutletId : null,
              ""
            )}
            className="dashboardSectionLink"
          >
            <span>{t("View full analytics")}</span>
            <LuArrowRight className="dashboardSectionLinkIcon" aria-hidden="true" />
          </Link>
        </div>

        {salesLoading && (
          <div className="dashboardBlock flex flex-col gap-4">
            <CardGridSkeleton count={4} />
            <TableSkeleton rows={6} columns={5} />
          </div>
        )}
        {salesError && (
          <div className="dashboardBlock">
            <ErrorState
              title={t("Failed to load sales")}
              description={
                salesErrorDetail instanceof Error
                  ? salesErrorDetail.message
                  : t("We couldn't load this section. Please try again.")
              }
            />
          </div>
        )}

        {!salesLoading && !salesError && (
          <>
            <div className="dashboardCards">
              {salesMetricCards.map((card) => (
                <DashboardMetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  sub={card.sub}
                  toneClassName={card.toneClassName}
                  icon={card.icon}
                />
              ))}
            </div>

            {dailySalesRows.length > 0 && (
              <div className="dashboardChartBlock dashboardLiveStockBlock">
                <h3 className="dashboardChartTitle">{t("Per Day Sales")}</h3>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Date")}</TableHead>
                        <TableHead>{t("Revenue")}</TableHead>
                        <TableHead>{t("Transactions")}</TableHead>
                        <TableHead>{t("Weight Sold")}</TableHead>
                        <TableHead>{t("Quantity Sold")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySalesRows.map((row) => (
                        <TableRow key={row.dateKey}>
                          <TableCell>{row.dateKey}</TableCell>
                          <TableCell>{formatDashboardMoney(row.revenue)}</TableCell>
                          <TableCell>{row.transactions}</TableCell>
                          <TableCell>{formatDashboardDecimal(row.weight)} kg</TableCell>
                          <TableCell>{formatDashboardDecimal(row.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {(salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0) && (
              <div className="dashboardCharts">
                {salesByOutlet.length > 0 && showTopOutlets && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top outlets")}</h3>
                    <div className="dashboardMobileMiniList">
                      {salesByOutlet.map((row: SalesByOutletItem) => (
                        <div key={row.outletId} className="dashboardMobileMiniRow">
                          <span className="dashboardMobileMiniIcon" aria-hidden="true">
                            <LuStore />
                          </span>
                          <span className="dashboardMobileMiniLabel">{row.outletName}</span>
                          <span className="dashboardMobileMiniValue">
                            {formatDashboardMoney(row.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="dashboardOutletBars">
                      {salesByOutlet.map((row: SalesByOutletItem) => {
                        const amount = row.totalAmount ?? 0;
                        const pct = (amount / maxOutletAmount) * 100;
                        return (
                          <div key={row.outletId} className="dashboardBarRow">
                            <span className="dashboardBarLabel">{row.outletName}</span>
                            <div className="dashboardBarTrack">
                              <div className="dashboardBarFill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="dashboardBarValue">{formatDashboardMoney(amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {salesByProduct.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top products")}</h3>
                    <div className="dashboardMobileMiniList">
                      {salesByProduct.map((row: SalesByProductItem) => (
                        <div key={row.productId} className="dashboardMobileMiniRow">
                          <span className="dashboardMobileMiniIcon" aria-hidden="true">
                            <LuPackage />
                          </span>
                          <span className="dashboardMobileMiniLabel">{row.productName}</span>
                          <span className="dashboardMobileMiniValue">
                            {formatDashboardMoney(row.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="dashboardProductList">
                      {salesByProduct.map((row: SalesByProductItem) => (
                        <div key={row.productId} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.productName}</span>
                          <span className="dashboardProductAmount">
                            {formatDashboardMoney(row.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {salesByCustomer.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top customers")}</h3>
                    <div className="dashboardMobileMiniList">
                      {salesByCustomer.map((row: SalesByCustomerItem, idx: number) => (
                        <div key={idx} className="dashboardMobileMiniRow">
                          <span className="dashboardMobileMiniIcon" aria-hidden="true">
                            <LuUsers />
                          </span>
                          <span className="dashboardMobileMiniLabel">{row.customerName}</span>
                          <span className="dashboardMobileMiniValue">
                            {formatDashboardMoney(row.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="dashboardProductList">
                      {salesByCustomer.map((row: SalesByCustomerItem, idx: number) => (
                        <div key={idx} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.customerName}</span>
                          <span className="dashboardProductAmount">
                            {formatDashboardMoney(row.totalAmount ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {totalTransactions === 0 && salesByOutlet.length === 0 && salesByProduct.length === 0 && salesByCustomer.length === 0 && (
              <div className="dashboardBlock">
                <EmptyState
                  title={t("No sales data yet.")}
                  description={t("Sales activity will appear here as soon as transactions are recorded.")}
                />
              </div>
            )}

            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Processed Sales Details")}</h3>
              <div className="dashboardCards dashboardCardsLivestock">
                <DashboardMetricCard
                  label={t("Processed Revenue")}
                  value={formatDashboardMoney(processedRevenue)}
                  toneClassName="dashboardCardRevenue"
                  icon={LuWallet}
                />
                <DashboardMetricCard
                  label={t("Processed Transactions")}
                  value={String(processedTransactions)}
                  toneClassName="dashboardCardTransactions"
                  icon={LuReceiptText}
                />
                <DashboardMetricCard
                  label={t("Processed Weight Sold")}
                  value={`${formatDashboardDecimal(processedWeight)} kg`}
                  toneClassName="dashboardCardWeight"
                  icon={LuScale}
                />
              </div>
              {processedProductsSold.length > 0 && (
                <div className="dashboardTrendingCard">
                  <h4 className="dashboardTrendingTitle">{t("Top Processed Item Sold")}</h4>
                  <div className="dashboardTrendingHead">
                    <span>#</span>
                    <span>{t("Item")}</span>
                    <span>{t("Qty Sold")}</span>
                    <span>{t("Total Sales")}</span>
                  </div>
                  <div className="dashboardTrendingBody">
                    {processedProductsSold.slice(0, 5).map((item, idx) => (
                      <div key={item.name} className="dashboardTrendingRow">
                        <span className="dashboardTrendingRank">{idx + 1}</span>
                        <span className="dashboardTrendingItem">{item.name}</span>
                        <span className="dashboardTrendingQty">{formatDashboardDecimal(item.quantity)}</span>
                        <span className="dashboardTrendingAmount">
                          {formatDashboardMoney(item.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {processedRows.length === 0 && (
                <EmptyState title={t("No processed sales yet.")} />
              )}
              {processedRows.length > 0 && (
                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Name")}</TableHead>
                        <TableHead>{t("Contact")}</TableHead>
                        <TableHead>{t("Type")}</TableHead>
                        <TableHead>{t("Processed Item")}</TableHead>
                        <TableHead>{t("Quantity")}</TableHead>
                        <TableHead>{t("Weight")}</TableHead>
                        <TableHead>{t("Amount")}</TableHead>
                        <TableHead>{t("Date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.map((row, index) => (
                        <TableRow key={`${row.transactionId}-${row.productName}-${index}`}>
                          <TableCell>{row.customerName || "-"}</TableCell>
                          <TableCell>{row.contact || "-"}</TableCell>
                          <TableCell>{row.type || "-"}</TableCell>
                          <TableCell>{row.productName || "-"}</TableCell>
                          <TableCell>{formatDashboardDecimal(row.quantity || 0)}</TableCell>
                          <TableCell>{formatDashboardDecimal(row.weight || 0)}</TableCell>
                          <TableCell>{formatDashboardMoney(row.amount)}</TableCell>
                          <TableCell>{row.date ? new Date(row.date).toLocaleString() : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {canShowUnscopedLivestock && (
            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Live Stock Sale Details")}</h3>
              <div className="dashboardCards dashboardCardsLivestock">
                <DashboardMetricCard
                  label={t("Livestock Revenue")}
                  value={formatDashboardMoney(livestockRevenue)}
                  toneClassName="dashboardCardRevenue"
                  icon={LuWallet}
                />
                <DashboardMetricCard
                  label={t("Livestock Transactions")}
                  value={String(livestockTransactions)}
                  toneClassName="dashboardCardTransactions"
                  icon={LuReceiptText}
                />
                <DashboardMetricCard
                  label={t("Livestock Weight Sold")}
                  value={`${formatDashboardDecimal(livestockWeight)} kg`}
                  toneClassName="dashboardCardWeight"
                  icon={LuScale}
                />
                <DashboardMetricCard
                  label={t("Livestock Quantity Sold")}
                  value={formatDashboardDecimal(livestockQuantity)}
                  toneClassName="dashboardCardQuantity"
                  icon={LuBoxes}
                />
              </div>
              {livestockSalesLoading && (
                <TableSkeleton rows={5} columns={6} />
              )}
              {livestockSalesError && (
                <ErrorState
                  title={t("Failed to load sales")}
                  description={
                    livestockSalesErrorDetail instanceof Error
                      ? livestockSalesErrorDetail.message
                      : t("We couldn't load this section. Please try again.")
                  }
                />
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length === 0 && (
                <EmptyState title={t("No live stock sales yet.")} />
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length > 0 && (
                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Name")}</TableHead>
                        <TableHead>{t("Contact")}</TableHead>
                        <TableHead>{t("Livestock Item")}</TableHead>
                        <TableHead>{t("Quantity")}</TableHead>
                        <TableHead>{t("Amount")}</TableHead>
                        <TableHead>{t("Date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {livestockSalesRows.map((row: LivestockSale, index) => {
                        const rowDate = row.createdAt ?? row.date;
                        const quantity = row.quantity ?? row.itemQuantityOrWeight ?? row.weight;
                        return (
                          <TableRow key={`${row.id ?? row.transactionId ?? "ls"}-${index}`}>
                            <TableCell>{row.name ?? "-"}</TableCell>
                            <TableCell>{row.contact ?? "-"}</TableCell>
                            <TableCell>{getLivestockDisplay(row)}</TableCell>
                            <TableCell>{typeof quantity === "number" ? formatDashboardDecimal(quantity) : "-"}</TableCell>
                            <TableCell>
                              {typeof row.amount === "number"
                                ? formatDashboardMoney(row.amount)
                                : "-"}
                            </TableCell>
                            <TableCell>{rowDate ? new Date(rowDate).toLocaleString() : "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            )}

            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Recent restock expenses")}</h3>
              <p className="dashboardChartSubtitle">
                {t("Livestock restock payments from expense history (most recent first).")}
              </p>
              {!livestockExpenseLoading && !livestockExpenseError && (
                <div className="dashboardCards dashboardCardsLivestock dashboardCardsExpenses">
                  {expenseMetricCards.map((card) => (
                    <DashboardMetricCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      toneClassName={card.toneClassName}
                      icon={card.icon}
                    />
                  ))}
                </div>
              )}
              {livestockExpenseLoading && (
                <TableSkeleton rows={5} columns={canRecordPayment ? 8 : 7} />
              )}
              {livestockExpenseError && (
                <ErrorState
                  title={t("Failed to load expense history")}
                  description={
                    livestockExpenseErrorDetail instanceof Error
                      ? livestockExpenseErrorDetail.message
                      : t("We couldn't load this section. Please try again.")
                  }
                />
              )}
              {!livestockExpenseLoading &&
                !livestockExpenseError &&
                dashboardExpenseRows.length === 0 && (
                  <EmptyState title={t("No restock expense records yet.")} />
                )}
              {!livestockExpenseLoading &&
                !livestockExpenseError &&
                dashboardExpenseRows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Date")}</TableHead>
                          <TableHead>{t("Livestock Item")}</TableHead>
                          <TableHead>{t("Supplier name")}</TableHead>
                          <TableHead>{t("Total amount")}</TableHead>
                          <TableHead>{t("Paid amount")}</TableHead>
                          <TableHead>{t("Due amount")}</TableHead>
                          <TableHead>{t("Payment status")}</TableHead>
                          {canRecordPayment && <TableHead>{t("Actions")}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboardExpenseRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDashboardExpenseDate(row.createdAt)}</TableCell>
                            <TableCell>{row.livestockItem.name}</TableCell>
                            <TableCell>{row.supplierName}</TableCell>
                            <TableCell>{formatDashboardMoney(row.totalAmount)}</TableCell>
                            <TableCell>{formatDashboardMoney(row.paidAmount)}</TableCell>
                            <TableCell>{formatDashboardMoney(row.dueAmount)}</TableCell>
                            <TableCell>{expensePaymentStatusLabel(row.paymentStatus, t)}</TableCell>
                            {canRecordPayment && (
                              <TableCell>
                                {canRecordExpensePayment(row.paymentStatus) ? (
                                  <ExpenseRecordPaymentButton
                                    compact
                                    onClick={() => setExpenseToPay(row)}
                                  />
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </div>
          </>
        )}
      </div>

      {canShowAttendance ? (
      <div className="dashboardSection dashboardSectionAttendance">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Attendance")}</h2>
          <Link
            to={buildPathWithOutletScope(
              "/dashboard/accounts/analytics",
              isScoped && scopedOutletId ? scopedOutletId : null,
              ""
            )}
            className="dashboardSectionLink"
          >
            <span>{t("View full analytics")}</span>
            <LuArrowRight className="dashboardSectionLinkIcon" aria-hidden="true" />
          </Link>
        </div>
        <div className="dashboardCards dashboardCardsAttendance">
          {attendanceMetricCards.map((card) => (
            <DashboardMetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              toneClassName={card.toneClassName}
              icon={card.icon}
            />
          ))}
        </div>
        <div className="dashboardChartBlock">
          <h3 className="dashboardChartTitle">{t("Staff attendance summary")}</h3>
          {dayAttendanceLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : dashboardAttendanceTableRows.length === 0 ? (
            <EmptyState title={t("No attendance records yet.")} />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Present days")}</TableHead>
                    <TableHead>{t("Total Hours")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardAttendanceTableRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.sessions}</TableCell>
                      <TableCell>{row.hours}</TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "Present" ? "success" : "warning"}
                        >
                          {t(row.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      ) : null}
    </section>
    <LivestockCompletePartialPaymentModal
      isOpen={Boolean(expenseToPay)}
      expense={expenseToPay}
      onClose={() => setExpenseToPay(null)}
      onSuccess={() => setExpenseToPay(null)}
    />
    </>
  );
}
