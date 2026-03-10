"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useI18n } from "@/app/providers/I18nProvider";
import { getOutlets } from "@/handlers/outlet";
import {
  getLivestockSales,
  getSales,
  type LivestockSale,
  type SaleTransaction,
} from "@/handlers/sale";
import "./transaction.scss";

const SALES_QUERY_KEY = ["sales"];
const LIVESTOCK_SALES_QUERY_KEY = ["livestockSales"];
const OUTLETS_QUERY_KEY = ["outlets"];

type TransactionDetailItem = {
  product: string;
  qtyKg: number | null;
  price: number | null;
};

type TransactionRecord = {
  id: string;
  timestamp: number;
  dateLabel: string;
  customer: string;
  contact: string;
  type: string;
  itemsCount: number;
  amount: number | null;
  outletId?: string;
  detailItems: TransactionDetailItem[];
};

function toTimestamp(raw: unknown): number {
  if (typeof raw !== "string" && typeof raw !== "number") return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatDate(raw: unknown): string {
  if (typeof raw === "string") return raw || "-";
  if (typeof raw === "number") return new Date(raw).toISOString();
  return "-";
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveName(
  value: string | { name?: string } | null | undefined,
  fallback: string
): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value || fallback;
  if (typeof value === "object" && "name" in value && typeof value.name === "string") {
    return value.name || fallback;
  }
  return fallback;
}

function getCustomerName(tx: SaleTransaction): string {
  if (typeof tx.name === "string" && tx.name) return tx.name;
  const fromCustomer = resolveName(tx.customer, "");
  return fromCustomer || "-";
}

function getTxType(tx: SaleTransaction): string {
  return resolveName(tx.type ?? tx.customerType, "-");
}

function getLivestockLabel(sale: LivestockSale): string {
  const saleItemId = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
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
  return saleItemId || "-";
}

function toTransactionFromSale(tx: SaleTransaction): TransactionRecord {
  const dateRaw = tx.date ?? tx.createdAt;
  const detailItems: TransactionDetailItem[] =
    tx.items?.map((item) => ({
      product:
        (typeof item.product === "string" && item.product) ||
        (item.product && typeof item.product.name === "string" ? item.product.name : "-"),
      qtyKg: getNumber(item.weight),
      price: getNumber(item.amount),
    })) ?? [];
  const amount = getNumber(tx.amount ?? tx.total ?? tx.totalAmount);
  const itemsCount = tx.itemsCount ?? tx.itemCount ?? detailItems.length ?? 0;

  return {
    id: tx.transactionId ?? tx.id ?? "-",
    timestamp: toTimestamp(dateRaw),
    dateLabel: formatDate(dateRaw),
    customer: getCustomerName(tx),
    contact: typeof tx.contact === "string" ? tx.contact : "-",
    type: getTxType(tx),
    itemsCount,
    amount,
    outletId: typeof tx.outletId === "string" ? tx.outletId : tx.outlet?.id,
    detailItems,
  };
}

function toTransactionFromLivestock(sale: LivestockSale, index: number): TransactionRecord {
  const dateRaw = sale.date ?? sale.createdAt;
  const amount = getNumber(sale.amount ?? sale.totalAmount);
  const weight = getNumber(sale.weight);
  const label = getLivestockLabel(sale);
  const maybeOutletId =
    typeof (sale as { outletId?: unknown }).outletId === "string"
      ? ((sale as { outletId: string }).outletId)
      : undefined;

  return {
    id: sale.transactionId ?? sale.id ?? `LS-${index + 1}`,
    timestamp: toTimestamp(dateRaw),
    dateLabel: formatDate(dateRaw),
    customer: typeof sale.name === "string" && sale.name ? sale.name : "-",
    contact: typeof sale.contact === "string" && sale.contact ? sale.contact : "-",
    type: "Livestock",
    itemsCount: 1,
    amount,
    outletId: maybeOutletId,
    detailItems: [
      {
        product: label,
        qtyKg: weight,
        price: amount,
      },
    ],
  };
}

function formatItemsCount(n: number, t: (text: string) => string): string {
  return n === 1 ? t("1 Item") : `${n} ${t("Items")}`;
}

function formatAmount(n: number | null): string {
  if (n == null) return "-";
  return `Rs.${n.toFixed(2)}`;
}

export default function TransactionPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);

  const {
    data: sales = [],
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

  const {
    data: livestockSales = [],
    isLoading: livestockLoading,
    isError: livestockError,
    error: livestockErrorDetail,
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

  const transactions = useMemo(() => {
    const standard = sales.map(toTransactionFromSale);
    const livestock = livestockSales.map((sale, index) => toTransactionFromLivestock(sale, index));
    return [...standard, ...livestock].sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, livestockSales]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          const match =
            tx.id.toLowerCase().includes(q) ||
            tx.customer.toLowerCase().includes(q) ||
            tx.type.toLowerCase().includes(q) ||
            formatAmount(tx.amount).toLowerCase().includes(q);
          if (!match) return false;
        }
        if (outletFilter) {
          if (!tx.outletId || tx.outletId !== outletFilter) return false;
        }
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

  const loading = salesLoading || livestockLoading;
  const error = salesError || livestockError;

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
        {loading && (
          <div className="transactionRow">
            <span className="transactionMessage">{t("Loading transactions...")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="transactionRow">
            <span className="transactionMessage transactionError">
              {salesErrorDetail instanceof Error
                ? salesErrorDetail.message
                : livestockErrorDetail instanceof Error
                  ? livestockErrorDetail.message
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
        {!loading && !error && transactions.length === 0 && (
          <div className="transactionRow">
            <span className="transactionMessage">{t("No transactions yet.")}</span>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {!loading &&
          !error &&
          transactions.length > 0 &&
          filteredTransactions.length === 0 && (
            <div className="transactionRow">
              <span className="transactionMessage">{t("No transactions match your search.")}</span>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        {!loading &&
          !error &&
          paginatedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="transactionRow transactionRowClickable"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTransaction(tx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedTransaction(tx);
                }
              }}
              aria-label={`${t("View details for transaction")} ${tx.id}`}
            >
              <span>{tx.id}</span>
              <span>{tx.dateLabel}</span>
              <span>{tx.customer}</span>
              <span>
                <span className="badge transactionTypeBadge">{tx.type}</span>
              </span>
              <span>{formatItemsCount(tx.itemsCount, t)}</span>
              <span className="transactionColAmount">{formatAmount(tx.amount)}</span>
              <div className="transactionMenuWrap">
                <button type="button" className="transactionMenuTrigger" aria-label={t("More options")}>
                  ⋮
                </button>
              </div>
            </div>
          ))}
      </div>

      {!loading && !error && filteredTransactions.length > 0 && (
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
        title={selectedTransaction ? `${t("Transaction")} ${selectedTransaction.id}` : ""}
        subtitle={selectedTransaction ? selectedTransaction.customer : ""}
        onClose={() => setSelectedTransaction(null)}
      >
        {selectedTransaction && (
          <div className="transactionDetail">
            <dl className="transactionDetailList">
              <dt>{t("Customer")}</dt>
              <dd>{selectedTransaction.customer}</dd>
              <dt>{t("Contact")}</dt>
              <dd>{selectedTransaction.contact}</dd>
              <dt>{t("Date & Time")}</dt>
              <dd>{selectedTransaction.dateLabel}</dd>
              <dt>{t("Type")}</dt>
              <dd>{selectedTransaction.type}</dd>
            </dl>
            <div className="transactionDetailItems">
              <div className="transactionDetailItemsHeader">
                {selectedTransaction.type === "Livestock" ? t("Livestock Sales Details") : t("Products")}
              </div>
              <table className="transactionDetailTable">
                <thead>
                  <tr>
                    <th>{selectedTransaction.type === "Livestock" ? t("Livestock Item ID") : t("Product")}</th>
                    <th>{t("Qty (kg)")}</th>
                    <th>{t("Price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransaction.detailItems.length === 0 ? (
                    <tr>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                  ) : (
                    selectedTransaction.detailItems.map((item, idx) => (
                      <tr key={`${selectedTransaction.id}-${idx}`}>
                        <td>{item.product}</td>
                        <td>{item.qtyKg ?? "-"}</td>
                        <td>{item.price != null ? `Rs.${item.price.toFixed(2)}` : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <dl className="transactionDetailList transactionDetailTotal">
              <dt>{t("Total")}</dt>
              <dd>{formatAmount(selectedTransaction.amount)}</dd>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  );
}
