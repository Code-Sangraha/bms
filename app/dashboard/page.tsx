"use client";

import { useState } from "react";
import { LuArrowRight } from "react-icons/lu";
import { Link, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import { useDashboardData } from "./hooks/useDashboardData";
import DashboardKPIGrid, { createSalesKPICards } from "./components/DashboardKPIGrid";
import DashboardRevenueDonut from "./components/DashboardRevenueDonut";
import DashboardCashflowChart from "./components/DashboardCashflowChart";
import DashboardTopLists from "./components/DashboardTopLists";
import DashboardProcessedTab from "./components/DashboardProcessedTab";
import DashboardLivestockTab from "./components/DashboardLivestockTab";
import DashboardExpensesTab from "./components/DashboardExpensesTab";
import DashboardAttendanceSection from "./components/DashboardAttendanceSection";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { CardGridSkeleton, TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import DashboardMobileHome from "./components/DashboardMobileHome";
import "./dashboard.scss";

export default function DashboardPage() {
  const { search } = useLocation();
  const data = useDashboardData();
  const {
    t,
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
    processedProductsSold,
    processedRows,
    dailySalesRows,
    cashflowLast7Days,
    salesByOutlet,
    salesByProduct,
    salesByCustomer,
    dashboardExpenseRows,
    livestockExpenseRows,
    livestockSalesRows,
    dashboardAttendanceTableRows,
    employees,
    dayAttendanceRows,
  } = data;

  const [activeTab, setActiveTab] = useState("processed");

  const salesKPICards = createSalesKPICards(t, {
    totalRevenue,
    totalTransactions,
    totalWeight,
    totalQuantity,
  });

  const totalStaff = effectiveOutletScopeId
    ? employees.filter((e) => e.outletId === effectiveOutletScopeId).length
    : employees.length;
  const presentToday = dayAttendanceRows.filter((r) => r.presentDays > 0).length;
  const totalHours = dayAttendanceRows.reduce((sum, r) => sum + (r.totalHoursWorked ?? 0), 0);

  return (
    <>
      <DashboardMobileHome
        t={t}
        scopedOutletId={isScoped && scopedOutletId ? scopedOutletId : null}
        search={search}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        totalExpenseDue={totalExpenseDue}
        totalTransactions={totalTransactions}
        totalWeight={totalWeight}
        totalQuantity={totalQuantity}
        processedRevenue={processedRevenue}
        livestockRevenue={livestockRevenue}
        cashflowDays={cashflowLast7Days}
        canCreate={capabilities.canCreateProcessedSales}
        canShowAttendance={canShowAttendance}
        presentToday={presentToday}
        totalStaff={totalStaff}
        totalHours={totalHours}
        processedRows={processedRows}
        livestockSalesRows={livestockSalesRows}
        dashboardExpenseRows={dashboardExpenseRows}
        canShowUnscopedLivestock={canShowUnscopedLivestock}
        outletScopedMobile={isOutletScopedDashboard && !capabilities.canCreateLivestockSales}
      />

      <section className="dashboardOverview">
        <div className="dashboardHero">
          <h1 className="dashboardTitle">{t("Dashboard")}</h1>
          <p className="dashboardSubtitle">{t("Sales, billing and attendance at a glance.")}</p>
        </div>

        {/* KPI Grid */}
        {salesLoading && (
          <div className="dashboardBlock">
            <CardGridSkeleton count={4} />
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
        {!salesLoading && !salesError && <DashboardKPIGrid cards={salesKPICards} />}

        {/* Charts Row: Revenue Donut + Cashflow */}
        {!salesLoading && !salesError && (
          <div className="dashboardChartsRow">
            <DashboardRevenueDonut
              data={{
                processed: processedRevenue,
                livestock: livestockRevenue,
                expenses: totalExpenses,
              }}
              t={t}
            />
            <DashboardCashflowChart data={cashflowLast7Days} t={t} />
          </div>
        )}

        {/* Top Lists */}
        {!salesLoading && !salesError && (
          <DashboardTopLists
            salesByOutlet={salesByOutlet}
            salesByProduct={salesByProduct}
            salesByCustomer={salesByCustomer}
            showTopOutlets={showTopOutlets}
            t={t}
          />
        )}

        {/* Tabbed Detail Section */}
        {!salesLoading && !salesError && (
          <div className="dashboardDetailSection">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="dashboardTabsList">
                <TabsTrigger value="processed">{t("Processed Sales")}</TabsTrigger>
                {canShowUnscopedLivestock && (
                  <TabsTrigger value="livestock">{t("Livestock Sales")}</TabsTrigger>
                )}
                <TabsTrigger value="expenses">{t("Expenses")}</TabsTrigger>
              </TabsList>

              <TabsContent value="processed">
                <DashboardProcessedTab
                  processedRevenue={processedRevenue}
                  processedTransactions={processedTransactions}
                  processedWeight={processedWeight}
                  processedQuantity={processedQuantity}
                  processedProductsSold={processedProductsSold}
                  processedRows={processedRows}
                  t={t}
                />
              </TabsContent>

              {canShowUnscopedLivestock && (
                <TabsContent value="livestock">
                  {livestockSalesLoading && <TableSkeleton rows={5} columns={6} />}
                  {livestockSalesError && (
                    <ErrorState
                      title={t("Failed to load livestock sales")}
                      description={
                        livestockSalesErrorDetail instanceof Error
                          ? livestockSalesErrorDetail.message
                          : t("We couldn't load this section. Please try again.")
                      }
                    />
                  )}
                  {!livestockSalesLoading && !livestockSalesError && (
                    <DashboardLivestockTab
                      livestockRevenue={livestockRevenue}
                      livestockTransactions={livestockTransactions}
                      livestockWeight={livestockWeight}
                      livestockQuantity={livestockQuantity}
                      livestockSalesRows={livestockSalesRows}
                      t={t}
                    />
                  )}
                </TabsContent>
              )}

              <TabsContent value="expenses">
                {livestockExpenseLoading && <TableSkeleton rows={5} columns={7} />}
                {livestockExpenseError && (
                  <ErrorState
                    title={t("Failed to load expenses")}
                    description={
                      livestockExpenseErrorDetail instanceof Error
                        ? livestockExpenseErrorDetail.message
                        : t("We couldn't load this section. Please try again.")
                    }
                  />
                )}
                {!livestockExpenseLoading && !livestockExpenseError && (
                  <DashboardExpensesTab
                    totalExpenses={totalExpenses}
                    totalExpensePaid={totalExpensePaid}
                    totalExpenseDue={totalExpenseDue}
                    livestockExpenseRows={livestockExpenseRows}
                    canRecordPayment={capabilities.canRestockLivestockInventory}
                    t={t}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Attendance Section */}
        {canShowAttendance && (
          <DashboardAttendanceSection
            totalStaff={totalStaff}
            presentToday={presentToday}
            totalHours={totalHours}
            outletsCount={outlets.length}
            effectiveOutletScopeId={effectiveOutletScopeId}
            outlets={outlets}
            dashboardAttendanceTableRows={dashboardAttendanceTableRows}
            dayAttendanceLoading={dayAttendanceLoading}
            t={t}
          />
        )}
      </section>
    </>
  );
}
