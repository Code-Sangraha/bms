import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import DashboardKPIGrid, { type KPICard } from "./DashboardKPIGrid";
import {
  formatDashboardMoney,
  formatDashboardExpenseDate,
  expensePaymentStatusLabel,
} from "../utils/dashboardFormatting";
import type { LivestockExpenseHistoryEntry } from "@/lib/api/livestockExpenseHistory";
import LivestockCompletePartialPaymentModal from "../product/liveProduct/LivestockCompletePartialPaymentModal";
import ExpenseRecordPaymentButton from "../shared/ExpenseRecordPaymentButton";
import { canRecordExpensePayment } from "@/lib/billing/expensePaymentUi";

type DashboardExpensesTabProps = {
  totalExpenses: number;
  totalExpensePaid: number;
  totalExpenseDue: number;
  livestockExpenseRows: LivestockExpenseHistoryEntry[];
  canRecordPayment: boolean;
  t: (key: string) => string;
};

export default function DashboardExpensesTab({
  totalExpenses,
  totalExpensePaid,
  totalExpenseDue,
  livestockExpenseRows,
  canRecordPayment,
  t,
}: DashboardExpensesTabProps) {
  const [expenseToPay, setExpenseToPay] = useState<LivestockExpenseHistoryEntry | null>(null);

  const kpiCards: KPICard[] = [
    {
      label: t("Total Expenses"),
      value: formatDashboardMoney(totalExpenses),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      toneClassName: "dashboardKPICardExpense",
    },
    {
      label: t("Paid Amount"),
      value: formatDashboardMoney(totalExpensePaid),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
      toneClassName: "dashboardKPICardRevenue",
    },
    {
      label: t("Due Amount"),
      value: formatDashboardMoney(totalExpenseDue),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      toneClassName: "dashboardKPICardWarning",
    },
  ];

  return (
    <div className="dashboardTabContent">
      <DashboardKPIGrid cards={kpiCards} />

      {livestockExpenseRows.length === 0 && (
        <EmptyState title={t("No expense records yet.")} />
      )}

      {livestockExpenseRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>{t("Livestock Item")}</TableHead>
                <TableHead>{t("Supplier")}</TableHead>
                <TableHead>{t("Total")}</TableHead>
                <TableHead>{t("Paid")}</TableHead>
                <TableHead>{t("Due")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                {canRecordPayment && <TableHead>{t("Actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {livestockExpenseRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDashboardExpenseDate(row.createdAt)}</TableCell>
                  <TableCell>{row.livestockItem.name}</TableCell>
                  <TableCell>{row.supplierName}</TableCell>
                  <TableCell>{formatDashboardMoney(row.totalAmount)}</TableCell>
                  <TableCell>{formatDashboardMoney(row.paidAmount)}</TableCell>
                  <TableCell>{formatDashboardMoney(row.dueAmount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.paymentStatus === "FULL"
                          ? "success"
                          : row.paymentStatus === "PARTIAL"
                            ? "warning"
                            : "info"
                      }
                    >
                      {expensePaymentStatusLabel(row.paymentStatus, t)}
                    </Badge>
                  </TableCell>
                  {canRecordPayment && (
                    <TableCell>
                      {canRecordExpensePayment(row.paymentStatus) ? (
                        <ExpenseRecordPaymentButton
                          compact
                          onClick={() => setExpenseToPay(row)}
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LivestockCompletePartialPaymentModal
        isOpen={Boolean(expenseToPay)}
        expense={expenseToPay}
        onClose={() => setExpenseToPay(null)}
        onSuccess={() => setExpenseToPay(null)}
      />
    </div>
  );
}
