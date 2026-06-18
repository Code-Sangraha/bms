"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LuShoppingCart } from "react-icons/lu";
import { Search, Settings } from "lucide-react";
import Pagination from "@/app/components/Pagination/Pagination";
import Modal from "@/app/components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
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
import { useI18n } from "@/app/providers/I18nProvider";
import { usePermissions } from "@/app/providers/AuthProvider";
import { useRowFilterOutletId } from "@/app/hooks/useRowFilterOutletId";
import { getOutlets } from "@/handlers/outlet";
import {
  getLivestockSales,
  LIVESTOCK_SALES_DASHBOARD_SUMMARY_LIMIT,
  getSales,
  type LivestockSale,
  type SaleTransaction,
} from "@/handlers/sale";
import { paymentMethodLabel } from "@/lib/salePaymentMethods";
import type { Locale } from "@/app/providers/I18nProvider";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import "./transaction.scss";

const SALES_QUERY_KEY = ["sales"];
const LIVESTOCK_SUMMARY_QUERY_KEY = ["livestockSales", "summary"];
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
  discountAmount: number | null;
  paymentMethodLabel: string | null;
  outletId?: string;
  detailItems: TransactionDetailItem[];
};

function toTimestamp(raw: unknown): number {
  if (typeof raw !== "string" && typeof raw !== "number") return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/** Human-readable date/time for lists and modals; keeps sort via `timestamp`. */
function formatTransactionDateTime(raw: unknown, locale: Locale): string {
  let ms: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    ms = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    ms = new Date(raw).getTime();
  } else {
    return "-";
  }
  if (!Number.isFinite(ms)) return "-";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "-";
  const localeTag = locale === "ne" ? "ne-NP" : "en-GB";
  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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

function resolveSaleLineProductName(item: {
  product?: string | { name?: string };
}): string {
  if (typeof item.product === "string" && item.product.trim()) return item.product.trim();
  if (
    item.product &&
    typeof item.product === "object" &&
    typeof item.product.name === "string" &&
    item.product.name.trim()
  ) {
    return item.product.name.trim();
  }
  return "";
}

function toTransactionFromSale(tx: SaleTransaction, locale: Locale): TransactionRecord {
  const dateRaw = tx.date ?? tx.createdAt;
  const detailItems: TransactionDetailItem[] =
    tx.items?.map((item) => ({
      product: resolveSaleLineProductName(item),
      qtyKg: getNumber(item.weight),
      price: getNumber(item.amount),
    })) ?? [];
  const amount = getNumber(tx.amount ?? tx.total ?? tx.totalAmount);
  const discountAmount = getNumber(tx.discountAmount);
  const paymentMethodLabelValue =
    typeof tx.paymentMethod === "string" && tx.paymentMethod.trim()
      ? paymentMethodLabel(tx.paymentMethod)
      : null;
  const itemsCount = tx.itemsCount ?? tx.itemCount ?? detailItems.length ?? 0;

  return {
    id: tx.transactionId ?? tx.id ?? "-",
    timestamp: toTimestamp(dateRaw),
    dateLabel: formatTransactionDateTime(dateRaw, locale),
    customer: getCustomerName(tx),
    contact: typeof tx.contact === "string" ? tx.contact : "-",
    type: getTxType(tx),
    itemsCount,
    amount,
    discountAmount,
    paymentMethodLabel: paymentMethodLabelValue,
    outletId: typeof tx.outletId === "string" ? tx.outletId : tx.outlet?.id,
    detailItems,
  };
}

function toTransactionFromLivestock(sale: LivestockSale, index: number, locale: Locale): TransactionRecord {
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
    dateLabel: formatTransactionDateTime(dateRaw, locale),
    customer: typeof sale.name === "string" && sale.name ? sale.name : "-",
    contact: typeof sale.contact === "string" && sale.contact ? sale.contact : "-",
    type: "Livestock",
    itemsCount: 1,
    amount,
    discountAmount: null,
    paymentMethodLabel: null,
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
  const { search } = useLocation();
  const { t, locale } = useI18n();
  const { roleName, capabilities } = usePermissions();
  const { isScoped, rowFilterOutletId } = useRowFilterOutletId();
  const [searchQuery, setSearchQuery] = useState("");
  const [outletFilter, setOutletFilter] = useState("");

  useEffect(() => {
    if (isScoped && rowFilterOutletId) setOutletFilter(rowFilterOutletId);
  }, [isScoped, rowFilterOutletId]);

  const effectiveOutletFilter =
    isScoped && rowFilterOutletId ? rowFilterOutletId : outletFilter;
  const moreHref = buildPathWithOutletScope(
    "/dashboard/more",
    isScoped && rowFilterOutletId ? rowFilterOutletId : null,
    search
  );
  const createProcessedSaleHref = buildPathWithOutletScope(
    "/dashboard/invoices/new",
    isScoped && rowFilterOutletId ? rowFilterOutletId : null,
    search
  );
  const canShowStaffMobileProcessedSale =
    roleName === "Staff" && capabilities.canCreateProcessedSales;
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
    queryKey: LIVESTOCK_SUMMARY_QUERY_KEY,
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
    const standard = sales.map((tx) => toTransactionFromSale(tx, locale));
    const livestock = livestockSales.map((sale, index) =>
      toTransactionFromLivestock(sale, index, locale)
    );
    return [...standard, ...livestock].sort((a, b) => b.timestamp - a.timestamp);
  }, [sales, livestockSales, locale]);

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
        if (effectiveOutletFilter) {
          if (!tx.outletId || tx.outletId !== effectiveOutletFilter) return false;
        }
        return true;
      }),
    [transactions, searchQuery, effectiveOutletFilter]
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
          <h1 className="pageTitle">{t("Transactions")}</h1>
          <p className="pageSubtitle">
            {t("View and manage recent sales transactions")}
          </p>
        </div>
        <div className="transactionHeaderActions">
          {canShowStaffMobileProcessedSale ? (
            <Link to={createProcessedSaleHref} className="transactionCreateSaleMobile">
              <LuShoppingCart size={18} aria-hidden />
              <span>{t("Processed Sale")}</span>
            </Link>
          ) : null}
          <Button
            asChild
            variant="outline"
            size="icon"
            className="text-muted-foreground"
            aria-label={t("Settings")}
          >
            <Link to={moreHref}>
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <div className="transactionToolbar">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("Search transactions")}
            className="pl-8"
          />
        </div>
        <div className="transactionFilterWrap">
          {!isScoped ? (
            <Select
              value={outletFilter || "__all__"}
              onValueChange={(v) =>
                setOutletFilter(v === "__all__" ? "" : v)
              }
            >
              <SelectTrigger
                className="w-full sm:w-56"
                aria-label={t("Filter by outlet")}
              >
                <SelectValue placeholder={t("All Outlets")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("All Outlets")}</SelectItem>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      {loading && <TableSkeleton rows={6} columns={7} />}
      {error && (
        <ErrorState
          title={t("Failed to load transactions")}
          description={
            salesErrorDetail instanceof Error
              ? salesErrorDetail.message
              : livestockErrorDetail instanceof Error
                ? livestockErrorDetail.message
                : t("We couldn't load this section. Please try again.")
          }
        />
      )}
      {!loading && !error && transactions.length === 0 && (
        <EmptyState title={t("No transactions yet.")} />
      )}
      {!loading &&
        !error &&
        transactions.length > 0 &&
        filteredTransactions.length === 0 && (
          <EmptyState title={t("No transactions match your search.")} />
        )}

      {!loading && !error && filteredTransactions.length > 0 && (
      <div className="transactionTable">
        <div className="transactionRow transactionRowHeader">
          <span>{t("Transaction ID")}</span>
          <span>{t("Date & Time")}</span>
          <span>{t("Customer")}</span>
          <span>{t("Type")}</span>
          <span>{t("Items")}</span>
          <span>{t("Payment")}</span>
          <span className="transactionColAmount">{t("Amount")}</span>
        </div>
        {paginatedTransactions.map((tx, i) => (
            <div
              key={`tx-row-${startIndex + i}`}
              className="transactionRow transactionRowData transactionRowClickable"
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
              <div className="transactionRowDesktop">
                <span>{tx.id}</span>
                <span>{tx.dateLabel}</span>
                <span>{tx.customer}</span>
                <span>
                  <span className="badge transactionTypeBadge">{tx.type}</span>
                </span>
                <span>{formatItemsCount(tx.itemsCount, t)}</span>
                <span>{tx.paymentMethodLabel ?? "-"}</span>
                <span className="transactionColAmount">{formatAmount(tx.amount)}</span>
              </div>
              <div className="transactionCardMobile">
                <div className="transactionCardMobileTop">
                  <span className="transactionCardMobileId">{tx.id}</span>
                  <time
                    className="transactionCardMobileDate"
                    {...(tx.timestamp > 0
                      ? { dateTime: new Date(tx.timestamp).toISOString() }
                      : {})}
                  >
                    {tx.dateLabel}
                  </time>
                </div>
                <div className="transactionCardMobileField" data-field-label={t("Customer")}>
                  {tx.customer}
                </div>
                <div className="transactionCardMobileMeta">
                  <div className="transactionCardMobileField" data-field-label={t("Type")}>
                    <span className="badge transactionTypeBadge">{tx.type}</span>
                  </div>
                  <div className="transactionCardMobileField" data-field-label={t("Items")}>
                    {formatItemsCount(tx.itemsCount, t)}
                  </div>
                  <div className="transactionCardMobileField" data-field-label={t("Payment")}>
                    {tx.paymentMethodLabel ?? "-"}
                  </div>
                </div>
                <div className="transactionCardMobileFooter">
                  <div className="transactionCardMobileAmountBlock" data-field-label={t("Amount")}>
                    <span className="transactionCardMobileAmount">{formatAmount(tx.amount)}</span>
                  </div>
                  <button
                    type="button"
                    className="transactionCardMobileViewBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTransaction(tx);
                    }}
                  >
                    {t("View details")}
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
      )}

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
              {selectedTransaction.paymentMethodLabel ? (
                <>
                  <dt>{t("Payment method")}</dt>
                  <dd>{selectedTransaction.paymentMethodLabel}</dd>
                </>
              ) : null}
              {selectedTransaction.discountAmount != null &&
              selectedTransaction.discountAmount > 0 ? (
                <>
                  <dt>{t("Discount")}</dt>
                  <dd>{formatAmount(selectedTransaction.discountAmount)}</dd>
                </>
              ) : null}
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
                        <td>{item.product || t("Waste sale")}</td>
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
