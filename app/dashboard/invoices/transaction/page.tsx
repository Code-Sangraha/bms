"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useI18n } from "@/app/providers/I18nProvider";
import { getSales, type SaleTransaction } from "@/handlers/sale";
import { getOutlets } from "@/handlers/outlet";
import "./transaction.scss";

const SALES_QUERY_KEY = ["sales"];
const OUTLETS_QUERY_KEY = ["outlets"];

function formatDate(tx: SaleTransaction): string {
  const raw = tx.date ?? tx.createdAt ?? "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return new Date(raw).toISOString().slice(0, 16).replace("T", " ");
  return "—";
}

function getTransactionId(tx: SaleTransaction): string {
  return tx.transactionId ?? tx.id ?? "—";
}

function resolveName(
  value: string | { name?: string } | null | undefined,
  fallback: string
): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value && typeof value.name === "string")
    return value.name;
  return fallback;
}

function getCustomerName(tx: SaleTransaction): string {
  if (tx.name != null && typeof tx.name === "string") return tx.name;
  const fromCustomer = resolveName(tx.customer, "");
  if (fromCustomer) return fromCustomer;
  return "—";
}

function getType(tx: SaleTransaction): string {
  return resolveName(tx.type ?? tx.customerType, "—");
}

function getItemsCount(
  tx: SaleTransaction,
  t: (text: string) => string
): string {
  const n = tx.itemsCount ?? tx.itemCount ?? 0;
  return n === 1 ? t("1 Item") : `${n} ${t("Items")}`;
}

function getAmount(tx: SaleTransaction): string {
  const n = tx.amount ?? tx.total ?? tx.totalAmount;
  if (n == null) return "—";
  return `Rs.${Number(n).toFixed(2)}`;
}

function getProductNames(tx: SaleTransaction): string {
  const names = tx.items
    ?.map((i) => (typeof i.product === "string" ? i.product : i.product?.name))
    .filter(Boolean) ?? [];
  return names.length === 0 ? "—" : names.join(", ");
}

export default function TransactionPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<SaleTransaction | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const {
    data: transactions = [],
    isLoading: salesLoading,
    isError: salesError,
    error: salesErrorDetail,
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

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const match =
            getTransactionId(tx).toLowerCase().includes(q) ||
            getCustomerName(tx).toLowerCase().includes(q) ||
            getType(tx).toLowerCase().includes(q) ||
            getAmount(tx).toLowerCase().includes(q);
          if (!match) return false;
        }
        if (outletFilter && tx.outletId && tx.outletId !== outletFilter)
          return false;
        return true;
      }),
    [transactions, searchQuery, outletFilter]
  );

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    startIndex,
    endIndex,
  } = usePagination(filteredTransactions.length, { defaultPageSize: 10 });
  const paginatedTransactions = useMemo(
    () => paginate(filteredTransactions, startIndex, endIndex),
    [filteredTransactions, startIndex, endIndex]
  );

  return (
    <section className="transactionPage">
      <div className="breadcrumb">
        <span>{t("Sales & Billing")}</span> {"›"} {t("Transaction")}
      </div>

      <div className="transactionHeader">
        <div className="transactionHeaderText">
          <h1 className="pageTitle">{t("Recent Transactions")}</h1>
          <p className="pageSubtitle">
            {t("View and manage recent sales transactions")}
          </p>
        </div>
      </div>

      <div className="transactionToolbar">
        <div className="transactionSearch">
          <span className="searchIcon">🔍</span>
          <input
            className="searchInput"
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search transactions")}
          />
        </div>
        <div className="transactionFilterWrap">
          <select
            className="transactionFilterSelect"
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            aria-label={t("Filter by outlet")}
          >
            <option value="">{t("All Outlets")}</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <span className="transactionLastSync">{t("Last sync: 2mins")}</span>
      </div>

      <div className="transactionTable">
        <div className="transactionRow transactionRowHeader">
          <span>{t("Transaction ID")}</span>
          <span>{t("Date & Time")}</span>
          <span>{t("Customer")}</span>
          <span>{t("Type")}</span>
          <span>{t("Items")}</span>
          <span className="transactionColAmount">{t("Amount")}</span>
          <span aria-label={t("Actions")} />
        </div>
        {salesLoading && (
          <div className="transactionRow">
            <span className="transactionMessage">{t("Loading transactions…")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {salesError && (
          <div className="transactionRow">
            <span className="transactionMessage transactionError">
              {salesErrorDetail instanceof Error
                ? salesErrorDetail.message
                : t("Failed to load transactions")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!salesLoading && !salesError && transactions.length === 0 && (
          <div className="transactionRow">
            <span className="transactionMessage">
              {t("No transactions yet.")}
            </span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!salesLoading &&
          !salesError &&
          transactions.length > 0 &&
          filteredTransactions.length === 0 && (
            <div className="transactionRow">
              <span className="transactionMessage">
                {t("No transactions match your search.")}
              </span>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!salesLoading &&
          !salesError &&
          paginatedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="transactionRow transactionRowClickable"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(".transactionMenuWrap")) return;
                setSelectedTransaction(tx);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!(e.target as HTMLElement).closest(".transactionMenuWrap")) {
                    setSelectedTransaction(tx);
                  }
                }
              }}
              aria-label={`${t("View details for transaction")} ${getTransactionId(tx)}`}
            >
              <span>{getTransactionId(tx)}</span>
              <span>{formatDate(tx)}</span>
              <span>{getCustomerName(tx)}</span>
              <span>
                <span className="badge transactionTypeBadge">
                  {getType(tx)}
                </span>
              </span>
              <span>{getItemsCount(tx, t)}</span>
              <span className="transactionColAmount">{getAmount(tx)}</span>
              <div className="transactionMenuWrap">
                <button
                  type="button"
                  className="transactionMenuTrigger"
                  aria-label={t("More options")}
                >
                  ⋮
                </button>
              </div>
            </div>
          ))}
      </div>

      {!salesLoading && !salesError && filteredTransactions.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTransactions.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          pageSizeOptions={[10, 20, 50]}
          onPageSizeChange={setPageSize}
        />
      )}

      <Modal
        isOpen={!!selectedTransaction}
        title={
          selectedTransaction
            ? `${t("Transaction")} ${getTransactionId(selectedTransaction)}`
            : ""
        }
        subtitle={selectedTransaction ? getCustomerName(selectedTransaction) : ""}
        onClose={() => setSelectedTransaction(null)}
      >
        {selectedTransaction && (
          <div className="transactionDetail">
            <dl className="transactionDetailList">
              <dt>{t("Customer")}</dt>
              <dd>{getCustomerName(selectedTransaction)}</dd>
              <dt>{t("Contact")}</dt>
              <dd>{selectedTransaction.contact || "—"}</dd>
              <dt>{t("Date & Time")}</dt>
              <dd>{formatDate(selectedTransaction)}</dd>
              <dt>{t("Type")}</dt>
              <dd>{getType(selectedTransaction)}</dd>
            </dl>
            {selectedTransaction.items && selectedTransaction.items.length > 0 && (
              <div className="transactionDetailItems">
                <div className="transactionDetailItemsHeader">{t("Products")}</div>
                <table className="transactionDetailTable">
                  <thead>
                    <tr>
                      <th>{t("Product")}</th>
                      <th>{t("Qty (kg)")}</th>
                      <th>{t("Price")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {typeof item.product === "string"
                            ? item.product
                            : item.product?.name ?? "—"}
                        </td>
                        <td>{item.weight ?? "—"}</td>
                        <td>
                          {item.amount != null
                            ? `Rs.${Number(item.amount).toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(!selectedTransaction.items || selectedTransaction.items.length === 0) && (
              <dl className="transactionDetailList">
                <dt>{t("Products")}</dt>
                <dd>{getProductNames(selectedTransaction)}</dd>
              </dl>
            )}
            <dl className="transactionDetailList transactionDetailTotal">
              <dt>{t("Total")}</dt>
              <dd>{getAmount(selectedTransaction)}</dd>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  );
}
