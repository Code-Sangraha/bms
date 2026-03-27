"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/app/providers/I18nProvider";
import { getProducts, type Product } from "@/handlers/product";
import { getProductTypes } from "@/handlers/productType";
import {
  getDashboardSales,
  getLivestockSales,
  getSales,
  type DashboardSalesData,
  type LivestockSale,
  type SaleTransaction,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import "./dashboard.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const LIVESTOCK_SALES_QUERY_KEY = ["livestockSales"];
const SALES_QUERY_KEY = ["sales"];
const PRODUCTS_QUERY_KEY = ["products"];
const PRODUCT_TYPES_QUERY_KEY = ["productTypes"];

const STATIC_ATTENDANCE_PREVIEW = [
  { name: "John Smith", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "Maria Garcia", clockIn: "07:00", clockOut: "16:00", status: "Present" as const },
  { name: "David Chen", clockIn: "—", clockOut: "—", status: "Absent" as const },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const { data: salesResponse, isLoading: salesLoading, isError: salesError, error: salesErrorDetail } = useQuery({
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

  const { data: salesTransactions = [] } = useQuery({
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

  const salesData: DashboardSalesData | undefined = salesResponse?.data;
  const apiTotalRevenue = salesData?.totalRevenue ?? 0;
  const apiTotalTransactions = salesData?.totalTransactions ?? 0;
  const apiTotalWeight = salesData?.totalWeight ?? 0;
  const apiTotalQuantity = salesData?.totalQuantity ?? 0;
  const salesByOutlet = (salesData?.salesByOutlet ?? []).slice(0, 5);
  const salesByProduct = (salesData?.salesByProduct ?? []).slice(0, 5);
  const salesByCustomer = (salesData?.salesByCustomer ?? []).slice(0, 5);

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

  const processedLineItems = useMemo(() => {
    const toNumber = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };

    const rows: Array<{
      transactionId: string;
      customerName: string;
      contact: string;
      type: string;
      productName: string;
      amount: number;
      weight: number;
      quantity: number;
      date: string;
    }> = [];

    for (const tx of salesTransactions as SaleTransaction[]) {
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
          productName: resolvedName,
          amount: itemAmount,
          weight: itemWeight,
          quantity: itemQuantity,
          date: txDate,
        });
      }
    }

    return rows;
  }, [salesTransactions, processedProductIdSet, processedProductNameSet, t]);

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

  const livestockRevenue = livestockSales.reduce(
    (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
    0
  );
  const livestockWeight = livestockSales.reduce(
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
  const livestockQuantity = livestockSales.reduce(
    (sum, row) =>
      sum +
      (typeof row.quantity === "number"
        ? row.quantity
        : typeof row.itemQuantityOrWeight === "number"
          ? row.itemQuantityOrWeight
          : 1),
    0
  );
  const livestockTransactions = livestockSales.length;

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

    for (const row of livestockSales) {
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
  }, [processedLineItems, livestockSales]);

  const totalRevenue = processedRevenue + livestockRevenue;
  const totalTransactions = processedTransactions + livestockTransactions;
  const totalWeight = processedWeight + livestockWeight;
  const totalQuantity = processedQuantity + livestockQuantity;

  const livestockSalesRows = [...livestockSales]
    .sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

  const maxOutletAmount = Math.max(...salesByOutlet.map((o) => o.totalAmount ?? 0), 1);

  return (
    <section className="dashboardOverview">
      <div className="dashboardHero">
        <h1 className="dashboardTitle">{t("Dashboard")}</h1>
        <p className="dashboardSubtitle">{t("Sales, billing and attendance at a glance.")}</p>
      </div>

      {/* Sales & Billing */}
      <div className="dashboardSection dashboardSectionSales">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Sales & Billing")}</h2>
          <Link to="/dashboard/invoices" className="dashboardSectionLink">
            {t("View full analytics")} →
          </Link>
        </div>

        {salesLoading && (
          <div className="dashboardBlock dashboardMessage">{t("Loading sales…")}</div>
        )}
        {salesError && (
          <div className="dashboardBlock dashboardMessage dashboardError">
            {salesErrorDetail instanceof Error ? salesErrorDetail.message : t("Failed to load sales")}
          </div>
        )}

        {!salesLoading && !salesError && (
          <>
            <div className="dashboardCards">
              <div className="dashboardCard dashboardCardRevenue">
                <span className="dashboardCardLabel">{t("Total Revenue")}</span>
                <span className="dashboardCardValue">
                  Rs.{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="dashboardCard dashboardCardTransactions">
                <span className="dashboardCardLabel">{t("Transactions")}</span>
                <span className="dashboardCardValue">{totalTransactions}</span>
              </div>
              <div className="dashboardCard dashboardCardWeight">
                <span className="dashboardCardLabel">{t("Weight Sold")}</span>
                <span className="dashboardCardValue">{totalWeight} kg</span>
              </div>
              <div className="dashboardCard dashboardCardQuantity">
                <span className="dashboardCardLabel">{t("Quantity Sold")}</span>
                <span className="dashboardCardValue">{totalQuantity}</span>
              </div>
            </div>

            {dailySalesRows.length > 0 && (
              <div className="dashboardChartBlock dashboardLiveStockBlock">
                <h3 className="dashboardChartTitle">{t("Per Day Sales")}</h3>
                <div className="dashboardSalesTableWrap">
                  <table className="dashboardSalesTable">
                    <thead>
                      <tr>
                        <th>{t("Date")}</th>
                        <th>{t("Revenue")}</th>
                        <th>{t("Transactions")}</th>
                        <th>{t("Weight Sold")}</th>
                        <th>{t("Quantity Sold")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySalesRows.map((row) => (
                        <tr key={row.dateKey}>
                          <td>{row.dateKey}</td>
                          <td>Rs.{row.revenue.toLocaleString("en-IN")}</td>
                          <td>{row.transactions}</td>
                          <td>{row.weight} kg</td>
                          <td>{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(salesByOutlet.length > 0 || salesByProduct.length > 0 || salesByCustomer.length > 0) && (
              <div className="dashboardCharts">
                {salesByOutlet.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top outlets")}</h3>
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
                            <span className="dashboardBarValue">Rs.{amount.toLocaleString("en-IN")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {salesByProduct.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top products")}</h3>
                    <div className="dashboardProductList">
                      {salesByProduct.map((row: SalesByProductItem) => (
                        <div key={row.productId} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.productName}</span>
                          <span className="dashboardProductAmount">
                            Rs.{(row.totalAmount ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {salesByCustomer.length > 0 && (
                  <div className="dashboardChartBlock">
                    <h3 className="dashboardChartTitle">{t("Top customers")}</h3>
                    <div className="dashboardProductList">
                      {salesByCustomer.map((row: SalesByCustomerItem, idx: number) => (
                        <div key={idx} className="dashboardProductRow">
                          <span className="dashboardProductName">{row.customerName}</span>
                          <span className="dashboardProductAmount">
                            Rs.{(row.totalAmount ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {totalTransactions === 0 && salesByOutlet.length === 0 && salesByProduct.length === 0 && salesByCustomer.length === 0 && (
              <div className="dashboardBlock dashboardMessage">{t("No sales data yet.")}</div>
            )}

            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Processed Sales Details")}</h3>
              <div className="dashboardCards dashboardCardsLivestock">
                <div className="dashboardCard dashboardCardRevenue">
                  <span className="dashboardCardLabel">{t("Processed Revenue")}</span>
                  <span className="dashboardCardValue">
                    Rs.{processedRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="dashboardCard dashboardCardTransactions">
                  <span className="dashboardCardLabel">{t("Processed Transactions")}</span>
                  <span className="dashboardCardValue">{processedTransactions}</span>
                </div>
                <div className="dashboardCard dashboardCardWeight">
                  <span className="dashboardCardLabel">{t("Processed Weight Sold")}</span>
                  <span className="dashboardCardValue">{processedWeight} kg</span>
                </div>
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
                        <span className="dashboardTrendingQty">{item.quantity}</span>
                        <span className="dashboardTrendingAmount">
                          Rs.{item.revenue.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {processedRows.length === 0 && (
                <div className="dashboardBlock dashboardMessage dashboardMessageInline">
                  {t("No processed sales yet.")}
                </div>
              )}
              {processedRows.length > 0 && (
                <div className="dashboardSalesTableWrap">
                  <table className="dashboardSalesTable">
                    <thead>
                      <tr>
                        <th>{t("Name")}</th>
                        <th>{t("Contact")}</th>
                        <th>{t("Type")}</th>
                        <th>{t("Processed Item")}</th>
                        <th>{t("Quantity")}</th>
                        <th>{t("Weight")}</th>
                        <th>{t("Amount")}</th>
                        <th>{t("Date")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedRows.map((row, index) => (
                        <tr key={`${row.transactionId}-${row.productName}-${index}`}>
                          <td>{row.customerName || "-"}</td>
                          <td>{row.contact || "-"}</td>
                          <td>{row.type || "-"}</td>
                          <td>{row.productName || "-"}</td>
                          <td>{row.quantity || 0}</td>
                          <td>{row.weight || 0}</td>
                          <td>Rs.{row.amount.toLocaleString("en-IN")}</td>
                          <td>{row.date ? new Date(row.date).toLocaleString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dashboardChartBlock dashboardLiveStockBlock">
              <h3 className="dashboardChartTitle">{t("Live Stock Sale Details")}</h3>
              <div className="dashboardCards dashboardCardsLivestock">
                <div className="dashboardCard dashboardCardRevenue">
                  <span className="dashboardCardLabel">{t("Livestock Revenue")}</span>
                  <span className="dashboardCardValue">
                    Rs.{livestockRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="dashboardCard dashboardCardTransactions">
                  <span className="dashboardCardLabel">{t("Livestock Transactions")}</span>
                  <span className="dashboardCardValue">{livestockTransactions}</span>
                </div>
                <div className="dashboardCard dashboardCardWeight">
                  <span className="dashboardCardLabel">{t("Livestock Weight Sold")}</span>
                  <span className="dashboardCardValue">{livestockWeight} kg</span>
                </div>
                <div className="dashboardCard dashboardCardQuantity">
                  <span className="dashboardCardLabel">{t("Livestock Quantity Sold")}</span>
                  <span className="dashboardCardValue">{livestockQuantity}</span>
                </div>
              </div>
              {livestockSalesLoading && (
                <div className="dashboardBlock dashboardMessage dashboardMessageInline">
                  {t("Loading sales…")}
                </div>
              )}
              {livestockSalesError && (
                <div className="dashboardBlock dashboardMessage dashboardError dashboardMessageInline">
                  {livestockSalesErrorDetail instanceof Error
                    ? livestockSalesErrorDetail.message
                    : t("Failed to load sales")}
                </div>
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length === 0 && (
                <div className="dashboardBlock dashboardMessage dashboardMessageInline">
                  {t("No live stock sales yet.")}
                </div>
              )}
              {!livestockSalesLoading && !livestockSalesError && livestockSalesRows.length > 0 && (
                <div className="dashboardSalesTableWrap">
                  <table className="dashboardSalesTable">
                    <thead>
                      <tr>
                        <th>{t("Name")}</th>
                        <th>{t("Contact")}</th>
                        <th>{t("Livestock Item")}</th>
                        <th>{t("Quantity")}</th>
                        <th>{t("Amount")}</th>
                        <th>{t("Date")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {livestockSalesRows.map((row: LivestockSale, index) => {
                        const rowDate = row.createdAt ?? row.date;
                        return (
                          <tr key={`${row.id ?? row.transactionId ?? "ls"}-${index}`}>
                            <td>{row.name ?? "-"}</td>
                            <td>{row.contact ?? "-"}</td>
                            <td>{getLivestockDisplay(row)}</td>
                            <td>{row.quantity ?? row.itemQuantityOrWeight ?? row.weight ?? "-"}</td>
                            <td>
                              {typeof row.amount === "number"
                                ? `Rs.${row.amount.toLocaleString("en-IN")}`
                                : "-"}
                            </td>
                            <td>{rowDate ? new Date(rowDate).toLocaleString() : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Attendance */}
      <div className="dashboardSection dashboardSectionAttendance">
        <div className="dashboardSectionHead">
          <h2 className="dashboardSectionTitle">{t("Attendance")}</h2>
          <Link to="/dashboard/accounts/analytics" className="dashboardSectionLink">
            {t("View full analytics")} →
          </Link>
        </div>
        <div className="dashboardCards dashboardCardsAttendance">
          <div className="dashboardCard dashboardCardStaff">
            <span className="dashboardCardLabel">{t("Total Staff")}</span>
            <span className="dashboardCardValue">32</span>
            <span className="dashboardCardSub">{t("4 departments")}</span>
          </div>
          <div className="dashboardCard dashboardCardPresent">
            <span className="dashboardCardLabel">{t("Present Today")}</span>
            <span className="dashboardCardValue">20</span>
            <span className="dashboardCardSub">{t("70% present")}</span>
          </div>
        </div>
        <div className="dashboardChartBlock">
          <h3 className="dashboardChartTitle">{t("Daily attendance")}</h3>
          <div className="dashboardAttendanceTableWrap">
            <table className="dashboardAttendanceTable">
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Clock In")}</th>
                  <th>{t("Clock Out")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {STATIC_ATTENDANCE_PREVIEW.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.name}</td>
                    <td>{row.clockIn}</td>
                    <td>{row.clockOut}</td>
                    <td>
                      <span className={`dashboardPill dashboardPill${row.status}`}>{t(row.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
