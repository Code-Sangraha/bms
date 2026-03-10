"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { getOutlets } from "@/handlers/outlet";
import {
  getLivestockItemsByProduct,
  getProducts,
  type LivestockItem,
  type Product,
} from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import {
  getLivestockSales,
  getSales,
  type LivestockSale,
  type SaleTransaction,
} from "@/handlers/sale";
import "./invoicesAnalytics.scss";

const OUTLETS_QUERY_KEY = ["outlets"];
const SALES_QUERY_KEY = ["sales"];
const LIVESTOCK_SALES_QUERY_KEY = ["livestockSales"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];
const LIVESTOCK_ITEMS_QUERY_KEY = ["livestockItemsByProduct"];
const LIVE_PRODUCT_TYPE_NAMES = ["live stock", "live"];

type DateRangeLabel = "12 months" | "3 months" | "30 days" | "7 days" | "24 hours";

type AggregatedRow = {
  key: string;
  name: string;
  amount: number;
  weight: number;
  quantity: number;
};

type SaleLine = {
  outletId: string | null;
  productKey: string;
  productName: string;
  customerName: string;
  amount: number;
  weight: number;
  quantity: number;
  timestamp: number;
};

function resolveLivestockItemId(item: LivestockItem): string | null {
  const fromId = typeof item.id === "string" ? item.id : null;
  const fromUnderscore = typeof (item as { _id?: unknown })._id === "string"
    ? (((item as unknown) as { _id: string })._id)
    : null;
  const fromLivestockItemId =
    typeof (item as { livestockItemId?: unknown }).livestockItemId === "string"
      ? (((item as unknown) as { livestockItemId: string }).livestockItemId)
      : null;
  return fromId ?? fromUnderscore ?? fromLivestockItemId ?? null;
}

function getRangeMs(label: DateRangeLabel): number {
  if (label === "24 hours") return 24 * 60 * 60 * 1000;
  if (label === "7 days") return 7 * 24 * 60 * 60 * 1000;
  if (label === "30 days") return 30 * 24 * 60 * 60 * 1000;
  if (label === "3 months") return 90 * 24 * 60 * 60 * 1000;
  return 365 * 24 * 60 * 60 * 1000;
}

function toTimestamp(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isInRange(timestamp: number, now: number, rangeMs: number): boolean {
  if (!timestamp) return false;
  return now - timestamp <= rangeMs;
}

export default function InvoicesAnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<DateRangeLabel>("12 months");
  const [outletFilter, setOutletFilter] = useState("all");

  const { data: outlets = [], isLoading: outletsLoading, isError: outletsError, error: outletsErrorDetail } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const { data: sales = [], isLoading: salesLoading, isError: salesError, error: salesErrorDetail } = useQuery({
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
    data: livestockSales = [],
    isLoading: livestockSalesLoading,
    isError: livestockSalesError,
    error: livestockSalesErrorDetail,
  } = useQuery({
    queryKey: LIVESTOCK_SALES_QUERY_KEY,
    queryFn: async () => {
      const result = await getLivestockSales();
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const { data: products = [] } = useQuery({
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

  const { data: productTypes = [] } = useQuery({
    queryKey: PRODUCT_TYPES_QUERY_KEY,
    queryFn: async () => {
      const result = await getProductTypes();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const liveTypeIds = useMemo(() => {
    const ids = new Set<string>();
    productTypes.forEach((pt) => {
      if (LIVE_PRODUCT_TYPE_NAMES.includes(pt.name.toLowerCase())) ids.add(pt.id);
    });
    return ids;
  }, [productTypes]);

  const liveStockProducts = useMemo(
    () =>
      products.filter((p: Product) => {
        const productTypeName =
          typeof p.productType === "object" && typeof p.productType?.name === "string"
            ? p.productType.name.toLowerCase()
            : "";
        return liveTypeIds.has(p.productTypeId) || LIVE_PRODUCT_TYPE_NAMES.includes(productTypeName);
      }),
    [products, liveTypeIds]
  );

  const liveStockProductIds = useMemo(
    () => liveStockProducts.map((product) => product.id).sort(),
    [liveStockProducts]
  );

  const { data: livestockItems = [] } = useQuery({
    queryKey: [...LIVESTOCK_ITEMS_QUERY_KEY, liveStockProductIds],
    enabled: liveStockProductIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        liveStockProductIds.map((productId) => getLivestockItemsByProduct(productId))
      );
      const merged: LivestockItem[] = [];
      for (const result of results) {
        if (!result.ok) {
          if (result.status === 401) navigate("/login");
          throw new Error(result.error);
        }
        merged.push(...result.data);
      }
      return merged;
    },
  });

  const outletNameById = useMemo(
    () => new Map(outlets.map((outlet) => [outlet.id, outlet.name])),
    [outlets]
  );

  const productOutletById = useMemo(
    () => new Map(products.map((product: Product) => [product.id, product.outletId])),
    [products]
  );

  const livestockMetaById = useMemo(() => {
    const map = new Map<string, { label: string; outletId: string | null }>();
    for (const item of livestockItems) {
      const id = resolveLivestockItemId(item);
      if (!id) continue;
      const label = `${item.itemId} - ${item.name}`;
      const outletId = productOutletById.get(item.productId) ?? null;
      map.set(id, { label, outletId });
    }
    return map;
  }, [livestockItems, productOutletById]);

  const now = Date.now();
  const rangeMs = getRangeMs(dateRange);

  const filteredNormalSales = useMemo(() => {
    return sales.filter((tx: SaleTransaction) => {
      const timestamp = toTimestamp(tx.createdAt ?? tx.date);
      if (!isInRange(timestamp, now, rangeMs)) return false;
      if (outletFilter === "all") return true;
      const outletId =
        (typeof tx.outletId === "string" && tx.outletId) ||
        (tx.outlet && typeof tx.outlet.id === "string" ? tx.outlet.id : "");
      return outletId === outletFilter;
    });
  }, [sales, now, rangeMs, outletFilter]);

  const filteredLivestockSales = useMemo(() => {
    return livestockSales.filter((sale: LivestockSale) => {
      const timestamp = toTimestamp(sale.createdAt ?? sale.date);
      if (!isInRange(timestamp, now, rangeMs)) return false;
      if (outletFilter === "all") return true;
      const itemId = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
      const outletId = itemId ? (livestockMetaById.get(itemId)?.outletId ?? null) : null;
      return outletId === outletFilter;
    });
  }, [livestockSales, now, rangeMs, outletFilter, livestockMetaById]);

  const normalLines = useMemo(() => {
    const lines: SaleLine[] = [];
    for (const tx of filteredNormalSales) {
      const txTimestamp = toTimestamp(tx.createdAt ?? tx.date);
      const txOutletId =
        (typeof tx.outletId === "string" && tx.outletId) ||
        (tx.outlet && typeof tx.outlet.id === "string" ? tx.outlet.id : null);
      const customerName =
        (typeof tx.name === "string" && tx.name) ||
        (typeof tx.customer === "object" && tx.customer && typeof tx.customer.name === "string"
          ? tx.customer.name
          : t("Unknown customer"));
      const txItems = Array.isArray(tx.items) ? tx.items : [];
      if (txItems.length === 0) {
        lines.push({
          outletId: txOutletId,
          productKey: "unknown-product",
          productName: t("Unknown product"),
          customerName,
          amount: toNumber(tx.totalAmount ?? tx.amount ?? tx.total),
          weight: 0,
          quantity: 0,
          timestamp: txTimestamp,
        });
        continue;
      }
      for (const item of txItems) {
        const productName =
          item.product && typeof item.product.name === "string"
            ? item.product.name
            : t("Unknown product");
        lines.push({
          outletId: txOutletId,
          productKey: productName,
          productName,
          customerName,
          amount: toNumber(item.amount),
          weight: toNumber(item.weight),
          quantity: toNumber((item as { quantity?: unknown }).quantity),
          timestamp: txTimestamp,
        });
      }
    }
    return lines;
  }, [filteredNormalSales, t]);

  const livestockLines = useMemo(() => {
    return filteredLivestockSales.map((sale) => {
      const itemId = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
      const meta = itemId ? livestockMetaById.get(itemId) : undefined;
      return {
        outletId: meta?.outletId ?? null,
        productKey: itemId || "unknown-livestock-item",
        productName: meta?.label ?? (itemId || t("Unknown livestock item")),
        customerName: sale.name || t("Unknown customer"),
        amount: toNumber(sale.amount ?? sale.totalAmount),
        weight: toNumber(sale.weight),
        quantity: 1,
        timestamp: toTimestamp(sale.createdAt ?? sale.date),
      } as SaleLine;
    });
  }, [filteredLivestockSales, livestockMetaById, t]);

  const allLines = useMemo(() => [...normalLines, ...livestockLines], [normalLines, livestockLines]);

  const totalRevenue = allLines.reduce((sum, line) => sum + line.amount, 0);
  const totalWeight = allLines.reduce((sum, line) => sum + line.weight, 0);
  const totalQuantity = allLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalTransactions = filteredNormalSales.length + filteredLivestockSales.length;

  const salesByOutlet = useMemo(() => {
    const map = new Map<string, AggregatedRow>();
    for (const line of allLines) {
      const key = line.outletId ?? "unknown";
      const name = line.outletId ? (outletNameById.get(line.outletId) ?? line.outletId) : t("Unknown outlet");
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { key, name, amount: line.amount, weight: line.weight, quantity: line.quantity });
      } else {
        prev.amount += line.amount;
        prev.weight += line.weight;
        prev.quantity += line.quantity;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [allLines, outletNameById, t]);

  const salesByProduct = useMemo(() => {
    const map = new Map<string, AggregatedRow>();
    for (const line of allLines) {
      const prev = map.get(line.productKey);
      if (!prev) {
        map.set(line.productKey, {
          key: line.productKey,
          name: line.productName,
          amount: line.amount,
          weight: line.weight,
          quantity: line.quantity,
        });
      } else {
        prev.amount += line.amount;
        prev.weight += line.weight;
        prev.quantity += line.quantity;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [allLines]);

  const salesByCustomer = useMemo(() => {
    const map = new Map<string, AggregatedRow>();
    for (const line of allLines) {
      const key = line.customerName || t("Unknown customer");
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          name: key,
          amount: line.amount,
          weight: line.weight,
          quantity: line.quantity,
        });
      } else {
        prev.amount += line.amount;
        prev.weight += line.weight;
        prev.quantity += line.quantity;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [allLines, t]);

  const maxOutletAmount = Math.max(...salesByOutlet.map((o) => o.amount), 1);

  const isLoading =
    outletsLoading ||
    salesLoading ||
    livestockSalesLoading;

  const isError =
    outletsError ||
    salesError ||
    livestockSalesError;

  const errorMessage =
    (outletsErrorDetail instanceof Error && outletsErrorDetail.message) ||
    (salesErrorDetail instanceof Error && salesErrorDetail.message) ||
    (livestockSalesErrorDetail instanceof Error && livestockSalesErrorDetail.message) ||
    t("Failed to load analytics");

  return (
    <section className="invoicesAnalyticsPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span>
        <span className="separator">&nbsp;&gt;&nbsp;</span>
        <span>{t("Analytics")}</span>
      </div>

      <div className="invoicesAnalyticsHeader">
        <div className="invoicesAnalyticsHeaderText">
          <h1 className="pageTitle">{t("Analytics")}</h1>
          <p className="pageSubtitle">
            {t("Track revenue, transactions and sales performance.")}
          </p>
        </div>
        <div className="invoicesAnalyticsToolbar">
          <div className="dateRangePills">
            {(["12 months", "3 months", "30 days", "7 days", "24 hours"] as DateRangeLabel[]).map((label) => (
              <button
                key={label}
                type="button"
                className={`dateRangePill ${dateRange === label ? "active" : ""}`}
                onClick={() => setDateRange(label)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <div className="toolbarRight">
            <select
              className="outletSelect"
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              aria-label={t("Filter by outlet")}
            >
              <option value="all">{t("All Outlets")}</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <span className="lastSync">{t("Live filter")}</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="invoicesAnalyticsMessage">{t("Loading analytics…")}</div>
      )}
      {isError && (
        <div className="invoicesAnalyticsMessage invoicesAnalyticsError">
          {errorMessage}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="summaryCards">
            <div className="summaryCard">
              <div className="summaryCardLabel">{t("Total Revenue")}</div>
              <div className="summaryCardValue">Rs.{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
              <div className="summaryCardTrend positive">—</div>
            </div>
            <div className="summaryCard">
              <div className="summaryCardLabel">{t("Total Transactions")}</div>
              <div className="summaryCardValue">{totalTransactions}</div>
              <div className="summaryCardTrend positive">—</div>
            </div>
            <div className="summaryCard">
              <div className="summaryCardLabel">{t("Total Weight")}</div>
              <div className="summaryCardValue">{totalWeight} kg</div>
              <div className="summaryCardTrend positive">—</div>
            </div>
            <div className="summaryCard">
              <div className="summaryCardLabel">{t("Total Quantity")}</div>
              <div className="summaryCardValue">{totalQuantity}</div>
              <div className="summaryCardTrend positive">—</div>
            </div>
          </div>

          {salesByOutlet.length > 0 && (
            <div className="chartSection">
              <h2 className="chartSectionTitle">{t("Outlet Performance")}</h2>
              <div className="outletBars">
                {salesByOutlet.map((row) => {
                  const pct = maxOutletAmount ? (row.amount / maxOutletAmount) * 100 : 0;
                  return (
                    <div key={row.key} className="outletBarRow">
                      <span className="outletBarLabel">{row.name}</span>
                      <div className="outletBarTrack">
                        <div
                          className="outletBarFill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="outletBarValue">Rs.{row.amount.toLocaleString("en-IN")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {salesByProduct.length > 0 && (
            <div className="chartSection">
              <h2 className="chartSectionTitle">{t("Sales by Product")}</h2>
              <div className="salesByProductTableWrap">
                <table className="salesByProductTable">
                  <thead>
                    <tr>
                      <th>{t("Product")}</th>
                      <th>{t("Amount (Rs.)")}</th>
                      <th>{t("Weight (kg)")}</th>
                      <th>{t("Quantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesByProduct.map((row) => (
                      <tr key={row.key}>
                        <td>{row.name}</td>
                        <td>{row.amount.toLocaleString("en-IN")}</td>
                        <td>{row.weight}</td>
                        <td>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {salesByCustomer.length > 0 && (
            <div className="chartSection">
              <h2 className="chartSectionTitle">{t("Sales by Customer")}</h2>
              <div className="salesByProductTableWrap">
                <table className="salesByProductTable">
                  <thead>
                    <tr>
                      <th>{t("Customer")}</th>
                      <th>{t("Amount (Rs.)")}</th>
                      <th>{t("Weight (kg)")}</th>
                      <th>{t("Quantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesByCustomer.map((row) => (
                      <tr key={row.key}>
                        <td>{row.name}</td>
                        <td>{row.amount.toLocaleString("en-IN")}</td>
                        <td>{row.weight}</td>
                        <td>{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {salesByOutlet.length === 0 &&
            salesByProduct.length === 0 &&
            salesByCustomer.length === 0 &&
            totalTransactions === 0 && (
              <div className="invoicesAnalyticsMessage">{t("No sales data yet.")}</div>
            )}
        </>
      )}
    </section>
  );
}
