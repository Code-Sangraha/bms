"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Pagination from "@/app/components/Pagination/Pagination";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { useAuth, usePermissions } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import { canRecordExpensePayment } from "@/lib/billing/expensePaymentUi";
import ExpenseRecordPaymentButton from "@/app/dashboard/shared/ExpenseRecordPaymentButton";
import LivestockCompletePartialPaymentModal from "@/app/dashboard/product/liveProduct/LivestockCompletePartialPaymentModal";
import {
  getOutletExpenses,
  getOutlets,
  type OutletExpenseEntry,
  type OutletExpensePaymentStatus,
} from "@/handlers/outlet";
import "../../product/liveProduct/livestockDetailShell.scss";
import "../../outlet/outlet.scss";
import "./expenses.scss";

const OUTLETS_QUERY_KEY = ["outlets"];
const OUTLET_EXPENSES_QUERY_KEY = "outletExpenses";

const PAYMENT_STATUS_BADGE_CLASS: Record<OutletExpensePaymentStatus, string> = {
  ADVANCE: "livestockDetailModalBadge livestockDetailModalBadgeAdvance",
  PARTIAL: "livestockDetailModalBadge livestockDetailModalBadgePartial",
  FULL: "livestockDetailModalBadge livestockDetailModalBadgeFull",
};

function formatPriceCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OutletExpensesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { userOutletId } = useAuth();
  const { capabilities } = usePermissions();
  const { accessTier } = useOutletAccess();
  const { rowFilterOutletId, isScoped } = useRowFilterOutletId();

  const isOutletLocked =
    accessTier === "outlet_staff" || accessTier === "driver" || Boolean(userOutletId);

  const canChangeOutletFilter = !isOutletLocked && !(isScoped && rowFilterOutletId);

  const [filterOutletId, setFilterOutletId] = useState<string>("");
  const [expenseToPay, setExpenseToPay] = useState<OutletExpenseEntry | null>(null);

  const canRecordPayment = capabilities.canRestockLivestockInventory;

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

  const lockedOutletId = useMemo(() => {
    if (isOutletLocked && userOutletId) return userOutletId;
    if (isScoped && rowFilterOutletId) return rowFilterOutletId;
    return undefined;
  }, [isOutletLocked, isScoped, rowFilterOutletId, userOutletId]);

  useEffect(() => {
    if (lockedOutletId) {
      setFilterOutletId(lockedOutletId);
    }
  }, [lockedOutletId]);

  const {
    data: allExpenses = [],
    isLoading,
    isError,
    error: errorDetail,
  } = useQuery({
    queryKey: [OUTLET_EXPENSES_QUERY_KEY, lockedOutletId ?? "all"],
    queryFn: async () => {
      const result = await getOutletExpenses(
        lockedOutletId ? { outletId: lockedOutletId } : {}
      );
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const filteredExpenses = useMemo(() => {
    if (!canChangeOutletFilter) return allExpenses;
    const outletId = filterOutletId.trim();
    if (!outletId) return allExpenses;
    return allExpenses.filter((row) => row.outletId === outletId);
  }, [allExpenses, canChangeOutletFilter, filterOutletId]);

  const expenseSummary = useMemo(() => {
    const totalDue = filteredExpenses.reduce((sum, row) => sum + row.dueAmount, 0);
    const openCount = filteredExpenses.filter((row) => canRecordExpensePayment(row.paymentStatus)).length;
    return { totalDue, partialCount: openCount, count: filteredExpenses.length };
  }, [filteredExpenses]);

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredExpenses.length, { defaultPageSize: 10 });

  const paginatedRows = useMemo(
    () => paginate(filteredExpenses, startIndex, endIndex),
    [filteredExpenses, startIndex, endIndex]
  );

  const paymentStatusLabel: Record<OutletExpensePaymentStatus, string> = {
    ADVANCE: t("Advance"),
    PARTIAL: t("Partial"),
    FULL: t("Full"),
  };

  const renderRows = (rows: OutletExpenseEntry[]) =>
    rows.map((row) => (
      <tr key={row.id}>
        <td>{row.outlet.name}</td>
        <td>{row.livestockItem.name}</td>
        <td>{row.supplierName}</td>
        <td>{row.supplierContact ?? "\u2014"}</td>
        <td className="outletExpensesAmountCell">{formatPriceCell(row.totalAmount)}</td>
        <td className="outletExpensesAmountCell">{formatPriceCell(row.paidAmount)}</td>
        <td className="outletExpensesAmountCell outletExpensesAmountCellDue">
          {formatPriceCell(row.dueAmount)}
        </td>
        <td>
          <span className={PAYMENT_STATUS_BADGE_CLASS[row.paymentStatus]}>
            {paymentStatusLabel[row.paymentStatus]}
          </span>
        </td>
        <td>{row.remarks ?? "\u2014"}</td>
        <td className="outletExpensesActionsCell">
          {canRecordPayment && canRecordExpensePayment(row.paymentStatus) ? (
            <ExpenseRecordPaymentButton onClick={() => setExpenseToPay(row)} />
          ) : (
            "\u2014"
          )}
        </td>
      </tr>
    ));

  return (
    <section className="outletPage outletExpensesPage">
      <div className="breadcrumb">
        <span>{t("Dashboard")}</span> {"›"} {t("Outlet expenses")}
      </div>

      <header className="outletHeader">
        <div className="outletHeaderText">
          <h1 className="pageTitle">{t("Outlet expenses")}</h1>
          <p className="pageSubtitle">
            {t("Livestock restock expenses by outlet and supplier.")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/outlet">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("Outlet Management")}
          </Link>
        </Button>
      </header>

      <div className="outletExpensesToolbar card">
        <div className="outletExpensesToolbarFilters">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {t("Filter by outlet")}
            </span>
            <Select
              value={filterOutletId || (canChangeOutletFilter ? "__all__" : undefined)}
              onValueChange={(value) => {
                setFilterOutletId(value === "__all__" ? "" : value);
                setCurrentPage(1);
              }}
              disabled={!canChangeOutletFilter}
            >
              <SelectTrigger
                className="w-[220px]"
                aria-label={t("Filter by outlet")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canChangeOutletFilter && (
                  <SelectItem value="__all__">{t("All outlets")}</SelectItem>
                )}
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isLoading && !isError && filteredExpenses.length > 0 && (
          <div className="outletExpensesSummary" aria-label={t("Expense summary")}>
            <span className="outletExpensesSummaryChip">
              {t("Records")}: <strong>{expenseSummary.count}</strong>
            </span>
            <span className="outletExpensesSummaryChip outletExpensesSummaryChipDue">
              {t("Total due")}: <strong>{formatPriceCell(expenseSummary.totalDue)}</strong>
            </span>
            {expenseSummary.partialCount > 0 && (
              <span className="outletExpensesSummaryChip">
                {t("Partial")}: <strong>{expenseSummary.partialCount}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {isLoading && <TableSkeleton rows={6} columns={10} />}
      {isError && (
        <ErrorState
          title={t("Failed to load expense history")}
          description={
            errorDetail instanceof Error ? errorDetail.message : undefined
          }
        />
      )}
      {!isLoading && !isError && filteredExpenses.length === 0 && (
        <EmptyState
          title={t("No expense records found.")}
          description={
            canChangeOutletFilter && filterOutletId
              ? t("Try selecting a different outlet or view all outlets.")
              : t(
                  "Restock expenses will appear here after livestock inventory is added."
                )
          }
        />
      )}

      {!isLoading && !isError && filteredExpenses.length > 0 && (
        <>
          <div className="outletExpensesTableCard">
            <div className="outletExpensesTableWrap">
              <table className="outletExpensesTable">
                <thead>
                  <tr>
                    <th>{t("Outlet")}</th>
                    <th>{t("Livestock item")}</th>
                    <th>{t("Supplier")}</th>
                    <th>{t("Supplier contact")}</th>
                    <th>{t("Total")}</th>
                    <th>{t("Paid")}</th>
                    <th>{t("Due")}</th>
                    <th>{t("Payment status")}</th>
                    <th>{t("Remarks")}</th>
                    <th>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>{renderRows(paginatedRows)}</tbody>
              </table>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredExpenses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <LivestockCompletePartialPaymentModal
        isOpen={Boolean(expenseToPay)}
        expense={expenseToPay}
        onClose={() => setExpenseToPay(null)}
        onSuccess={() => setExpenseToPay(null)}
      />
    </section>
  );
}
