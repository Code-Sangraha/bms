import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const LIVESTOCK_SALES_SUMMARY_QUERY_KEY = ["livestockSales", "summary"];
const SALES_QUERY_KEY = ["sales"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const OUTLETS_QUERY_KEY = ["outlets"];
const LIVESTOCK_EXPENSE_DASHBOARD_QUERY_KEY = ["livestockExpenseHistory", "dashboard"];
const DASHBOARD_ATTENDANCE_QUERY_KEY = ["attendanceAnalytics", "dashboard", "day"];
const EMPLOYEES_QUERY_KEY = ["employees"];
const DASHBOARD_EXPENSE_ROW_LIMIT = 20;

export type ProcessedLineItem = {
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

export type DailySalesRow = {
  dateKey: string;
  revenue: number;
  transactions: number;
  weight: number;
  quantity: number;
};

export type CashflowDay = {
  dateKey: string;
  label: string;
  moneyIn: number;
  moneyOut: number;
};

function resolveSaleOutletId(tx: SaleTransaction): string {
  const nested = tx.outlet && typeof tx.outlet.id === "string" ? tx.outlet.id : "";
  return String(tx.outletId ?? nested).trim();
}

export function useDashboardData() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isScoped, scopedOutletId } = useOutletScope();
  const { rowFilterOutletId } = useRowFilterOutletId();
  const { accessTier, lockedOutletId } = useOutletAccess();
  const { userOutletId } = useAuth();
  const { capabilities } = usePermissions();

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

  const canShowAttendance = capabilities.canViewAttendance;
  const isOutletScopedDashboard = Boolean(effectiveOutletScopeId);
  const canShowUnscopedLivestock = !isOutletScopedDashboard;
  const showTopOutlets = !isOutletScopedDashboard;

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

  const scopedSalesTransactions = useMemo(() => {
    if (!effectiveOutletScopeId) return salesTransactions;
    return (salesTransactions as SaleTransaction[]).filter(
      (tx) => resolveSaleOutletId(tx) === effectiveOutletScopeId
    );
  }, [effectiveOutletScopeId, salesTransactions]);

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

  const dashboardExpenseRows = useMemo(
    () => livestockExpenseRows.slice(0, DASHBOARD_EXPENSE_ROW_LIMIT),
    [livestockExpenseRows]
  );

  const livestockSalesRows = [...dashboardLivestockSales]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

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

  return {
    t,
    navigate,
    isScoped,
    scopedOutletId,
    effectiveOutletScopeId,
    capabilities,
    canShowAttendance,
    isOutletScopedDashboard,
    canShowUnscopedLivestock,
    showTopOutlets,
    outlets,
    salesLoading,
    salesError,
    salesErrorDetail,
    livestockSalesLoading,
    livestockSalesError,
    livestockSalesErrorDetail,
    livestockExpenseLoading,
    livestockExpenseError,
    livestockExpenseErrorDetail,
    dayAttendanceLoading,
    totalRevenue,
    totalTransactions,
    totalWeight,
    totalQuantity,
    totalExpenses,
    totalExpensePaid,
    totalExpenseDue,
    processedRevenue,
    processedTransactions,
    processedWeight,
    processedQuantity,
    livestockRevenue,
    livestockTransactions,
    livestockWeight,
    livestockQuantity,
    processedLineItems,
    processedRows,
    processedProductsSold,
    dailySalesRows,
    cashflowLast7Days,
    salesByOutlet,
    salesByProduct,
    salesByCustomer,
    dashboardExpenseRows,
    livestockExpenseRows,
    livestockSalesRows,
    dashboardAttendanceTableRows,
    dayAttendanceRows,
    employees,
  };
}

function formatDashboardAttendanceHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const totalMinutes = Math.round(h * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}
