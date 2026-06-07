"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination/Pagination";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { useAuth } from "@/app/providers/AuthProvider";
import { useOutletAccess } from "@/app/providers/OutletAccessProvider";
import { useI18n } from "@/app/providers/I18nProvider";
import {
  getOutletExpenses,
  getOutlets,
  type OutletExpenseEntry,
  type OutletExpensePaymentStatus,
} from "@/handlers/outlet";
import "../../product/inventoryDetailPage.scss";
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
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OutletExpensesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { userOutletId } = useAuth();
  const { accessTier } = useOutletAccess();
  const { rowFilterOutletId, isScoped } = useRowFilterOutletId();

  const isOutletLocked =
    accessTier === "outlet_staff" || accessTier === "driver" || Boolean(userOutletId);

  const [filterOutletId, setFilterOutletId] = useState<string>("");

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

  const effectiveFilterOutletId = useMemo(() => {
    if (isOutletLocked && userOutletId) return userOutletId;
    if (isScoped && rowFilterOutletId) return rowFilterOutletId;
    return filterOutletId.trim() || undefined;
  }, [filterOutletId, isOutletLocked, isScoped, rowFilterOutletId, userOutletId]);

  useEffect(() => {
    if (isOutletLocked && userOutletId) {
      setFilterOutletId(userOutletId);
    } else if (isScoped && rowFilterOutletId) {
      setFilterOutletId(rowFilterOutletId);
    }
  }, [isOutletLocked, isScoped, rowFilterOutletId, userOutletId]);

  const {
    data: expenses = [],
    isLoading,
    isError,
    error: errorDetail,
  } = useQuery({
    queryKey: [OUTLET_EXPENSES_QUERY_KEY, effectiveFilterOutletId ?? "all"],
    queryFn: async () => {
      const result = await getOutletExpenses(
        effectiveFilterOutletId ? { outletId: effectiveFilterOutletId } : {}
      );
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(expenses.length, { defaultPageSize: 10 });

  const paginatedRows = useMemo(
    () => paginate(expenses, startIndex, endIndex),
    [expenses, startIndex, endIndex]
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
        <td>{formatPriceCell(row.totalAmount)}</td>
        <td>{formatPriceCell(row.paidAmount)}</td>
        <td>{formatPriceCell(row.dueAmount)}</td>
        <td>
          <span className={PAYMENT_STATUS_BADGE_CLASS[row.paymentStatus]}>
            {paymentStatusLabel[row.paymentStatus]}
          </span>
        </td>
        <td>{row.remarks ?? "\u2014"}</td>
      </tr>
    ));

  return (
    <section className="outletPage outletExpensesPage">
      <div className="breadcrumb">
        <span>{t("Dashboard")}</span> {"›"} {t("Outlet expenses")}
      </div>

      <div className="outletHeader">
        <div className="outletHeaderText">
          <h1 className="pageTitle">{t("Outlet expenses")}</h1>
          <p className="pageSubtitle">
            {t("Livestock restock expenses by outlet and supplier.")}
          </p>
        </div>
        <Link to="/dashboard/outlet" className="button">
          {t("Outlet Management")}
        </Link>
      </div>

      <div className="outletExpensesToolbar card">
        <label className="field outletExpensesFilter">
          <span className="label">{t("Outlet")}</span>
          <select
            className="select"
            value={filterOutletId}
            onChange={(e) => setFilterOutletId(e.target.value)}
            disabled={isOutletLocked || (isScoped && Boolean(rowFilterOutletId))}
            aria-label={t("Filter by outlet")}
          >
            {!isOutletLocked && !(isScoped && rowFilterOutletId) && (
              <option value="">{t("All outlets")}</option>
            )}
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <p className="outletPageMessage">{t("Loading expense history…")}</p>
      )}
      {isError && (
        <p className="outletPageMessage outletPageError" role="alert">
          {errorDetail instanceof Error
            ? errorDetail.message
            : t("Failed to load expense history")}
        </p>
      )}
      {!isLoading && !isError && expenses.length === 0 && (
        <p className="outletPageMessage">{t("No expense records found.")}</p>
      )}

      {!isLoading && !isError && expenses.length > 0 && (
        <>
          <div className="outletExpensesTableWrap inventoryDetailSampleTableWrap">
            <table className="inventoryDetailSampleTable outletExpensesTable">
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
                </tr>
              </thead>
              <tbody>{renderRows(paginatedRows)}</tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={expenses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={[10, 20, 50]}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </section>
  );
}
