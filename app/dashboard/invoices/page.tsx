"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getDashboardSales,
  type DashboardSalesData,
  type SalesByCustomerItem,
  type SalesByOutletItem,
  type SalesByProductItem,
} from "@/handlers/sale";
import { getOutlets } from "@/handlers/outlet";
import "./invoicesAnalytics.scss";

const DASHBOARD_SALES_QUERY_KEY = ["dashboardSales"];
const OUTLETS_QUERY_KEY = ["outlets"];

export default function InvoicesAnalyticsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState("12 months");
  const [outletFilter, setOutletFilter] = useState("all");

  const { data: salesResponse, isLoading, isError, error } = useQuery({
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

  const { data: outlets = [] } = useQuery({
    queryKey: OUTLETS_QUERY_KEY,
    queryFn: async () => {
      const result = await getOutlets();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const data: DashboardSalesData | undefined = salesResponse?.data;
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalTransactions = data?.totalTransactions ?? 0;
  const totalWeight = data?.totalWeight ?? 0;
  const totalQuantity = data?.totalQuantity ?? 0;
  const salesByOutlet = data?.salesByOutlet ?? [];
  const salesByProduct = data?.salesByProduct ?? [];
  const salesByCustomer = data?.salesByCustomer ?? [];

  const maxOutletAmount = Math.max(
    ...salesByOutlet.map((o) => o.totalAmount ?? 0),
    1
  );

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
            {["12 months", "3 months", "30 days", "7 days", "24 hours"].map((label) => (
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
            <span className="lastSync">{t("Last sync: 2mins")}</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="invoicesAnalyticsMessage">{t("Loading analytics…")}</div>
      )}
      {isError && (
        <div className="invoicesAnalyticsMessage invoicesAnalyticsError">
          {error instanceof Error ? error.message : t("Failed to load analytics")}
        </div>
      )}

      {!isLoading && !isError && data && (
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
                {salesByOutlet.map((row: SalesByOutletItem) => {
                  const amount = row.totalAmount ?? 0;
                  const pct = maxOutletAmount ? (amount / maxOutletAmount) * 100 : 0;
                  return (
                    <div key={row.outletId} className="outletBarRow">
                      <span className="outletBarLabel">{row.outletName}</span>
                      <div className="outletBarTrack">
                        <div
                          className="outletBarFill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="outletBarValue">Rs.{amount.toLocaleString("en-IN")}</span>
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
                    {salesByProduct.map((row: SalesByProductItem) => (
                      <tr key={row.productId}>
                        <td>{row.productName}</td>
                        <td>{(row.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                        <td>{row.totalWeight ?? "—"}</td>
                        <td>{row.totalQuantity ?? "—"}</td>
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
                    {salesByCustomer.map((row: SalesByCustomerItem, idx: number) => (
                      <tr key={idx}>
                        <td>{row.customerName}</td>
                        <td>{(row.totalAmount ?? 0).toLocaleString("en-IN")}</td>
                        <td>{row.totalWeight ?? "—"}</td>
                        <td>{row.totalQuantity ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {salesByOutlet.length === 0 && salesByProduct.length === 0 && salesByCustomer.length === 0 && totalTransactions === 0 && (
            <div className="invoicesAnalyticsMessage">{t("No sales data yet.")}</div>
          )}
        </>
      )}
    </section>
  );
}
