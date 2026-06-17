"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LuReceiptText } from "react-icons/lu";
import { useI18n } from "@/app/providers/I18nProvider";
import { getSalesByProductId, type SaleTransaction } from "@/handlers/sale";
import { paymentMethodLabel } from "@/lib/salePaymentMethods";

type ProcessedProductSalesPanelProps = {
  productId: string;
};

type SalesRow = {
  id: string;
  dateLabel: string;
  customer: string;
  weight: string;
  amount: string;
  payment: string;
};

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function customerName(tx: SaleTransaction): string {
  if (typeof tx.name === "string" && tx.name.trim()) return tx.name.trim();
  if (typeof tx.customer === "string" && tx.customer.trim()) return tx.customer.trim();
  if (tx.customer && typeof tx.customer === "object" && typeof tx.customer.name === "string") {
    return tx.customer.name;
  }
  return "—";
}

function formatDate(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatPrice(n: number | null): string {
  if (n == null) return "—";
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWeight(n: number | null): string {
  if (n == null) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function toSalesRows(transactions: SaleTransaction[]): SalesRow[] {
  return transactions.map((tx) => {
    const lineWeight =
      getNumber(tx.weight) ??
      tx.items?.reduce((sum, item) => sum + (getNumber(item.weight) ?? 0), 0) ??
      null;
    const amount = getNumber(tx.amount ?? tx.total ?? tx.totalAmount);
    const payment =
      typeof tx.paymentMethod === "string" && tx.paymentMethod.trim()
        ? paymentMethodLabel(tx.paymentMethod)
        : "—";

    return {
      id: tx.transactionId ?? tx.id ?? "—",
      dateLabel: formatDate(tx.date ?? tx.createdAt),
      customer: customerName(tx),
      weight: formatWeight(lineWeight),
      amount: formatPrice(amount),
      payment,
    };
  });
}

export default function ProcessedProductSalesPanel({ productId }: ProcessedProductSalesPanelProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const { data: transactions = [], isLoading, isError } = useQuery({
    queryKey: ["salesByProductId", productId],
    queryFn: async () => {
      const result = await getSalesByProductId(productId);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: Boolean(productId.trim()),
  });

  const rows = useMemo(() => toSalesRows(transactions), [transactions]);

  const totalAmount = useMemo(
    () =>
      transactions.reduce(
        (sum, tx) => sum + (getNumber(tx.amount ?? tx.total ?? tx.totalAmount) ?? 0),
        0
      ),
    [transactions]
  );

  return (
    <section className="processedProductSalesPanel" aria-labelledby="processed-product-sales-title">
      <header className="processedProductSalesHeader">
        <div className="processedProductSalesHeaderText">
          <h2 id="processed-product-sales-title" className="processedProductSalesTitle">
            {t("Sales history")}
          </h2>
          <p className="processedProductSalesSubtitle">
            {t("Transactions that include this product.")}
          </p>
        </div>
        {!isLoading && rows.length > 0 ? (
          <div className="processedProductSalesSummary">
            <span className="processedProductSalesSummaryLabel">{t("Total revenue")}</span>
            <span className="processedProductSalesSummaryValue">{formatPrice(totalAmount)}</span>
          </div>
        ) : null}
      </header>

      <div className="processedProductSalesTableWrap">
        <table className="processedProductSalesTable">
          <thead>
            <tr>
              <th>{t("Transaction")}</th>
              <th>{t("Date")}</th>
              <th>{t("Customer")}</th>
              <th>{t("Weight")}</th>
              <th>{t("Amount")}</th>
              <th>{t("Payment")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6}>{t("Loading…")}</td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6}>{t("Could not load sales for this product.")}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="processedProductSalesEmpty">
                    <LuReceiptText aria-hidden className="processedProductSalesEmptyIcon" />
                    <p>{t("No sales recorded for this product yet.")}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="processedProductSalesTxId">{row.id}</td>
                  <td>{row.dateLabel}</td>
                  <td className="processedProductSalesCustomer">{row.customer}</td>
                  <td>{row.weight}</td>
                  <td className="processedProductSalesAmount">{row.amount}</td>
                  <td>{row.payment}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
