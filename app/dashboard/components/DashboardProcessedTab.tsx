import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import DashboardKPIGrid, { type KPICard } from "./DashboardKPIGrid";
import { formatDashboardMoney, formatDashboardDecimal } from "../utils/dashboardFormatting";
import type { ProcessedLineItem } from "../hooks/useDashboardData";

type DashboardProcessedTabProps = {
  processedRevenue: number;
  processedTransactions: number;
  processedWeight: number;
  processedQuantity: number;
  processedProductsSold: Array<{ name: string; revenue: number; quantity: number }>;
  processedRows: ProcessedLineItem[];
  t: (key: string) => string;
};

export default function DashboardProcessedTab({
  processedRevenue,
  processedTransactions,
  processedWeight,
  processedQuantity,
  processedProductsSold,
  processedRows,
  t,
}: DashboardProcessedTabProps) {
  const kpiCards: KPICard[] = [
    {
      label: t("Processed Revenue"),
      value: formatDashboardMoney(processedRevenue),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      ),
      toneClassName: "dashboardKPICardRevenue",
    },
    {
      label: t("Processed Transactions"),
      value: String(processedTransactions),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      ),
      toneClassName: "dashboardKPICardTransactions",
    },
    {
      label: t("Processed Weight Sold"),
      value: `${formatDashboardDecimal(processedWeight)} kg`,
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      ),
      toneClassName: "dashboardKPICardWeight",
    },
  ];

  return (
    <div className="dashboardTabContent">
      <DashboardKPIGrid cards={kpiCards} />

      {processedProductsSold.length > 0 && (
        <div className="dashboardTrendingCard">
          <h4 className="dashboardTrendingTitle">{t("Top Processed Items Sold")}</h4>
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
                <span className="dashboardTrendingQty">{formatDashboardDecimal(item.quantity)}</span>
                <span className="dashboardTrendingAmount">{formatDashboardMoney(item.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {processedRows.length === 0 && <EmptyState title={t("No processed sales yet.")} />}

      {processedRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("Contact")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("Type")}</TableHead>
                <TableHead>{t("Processed Item")}</TableHead>
                <TableHead>{t("Quantity")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("Weight")}</TableHead>
                <TableHead>{t("Amount")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRows.map((row, index) => (
                <TableRow key={`${row.transactionId}-${row.productName}-${index}`}>
                  <TableCell>{row.customerName || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">{row.contact || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">{row.type || "-"}</TableCell>
                  <TableCell>{row.productName || "-"}</TableCell>
                  <TableCell>{formatDashboardDecimal(row.quantity || 0)}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatDashboardDecimal(row.weight || 0)}</TableCell>
                  <TableCell>{formatDashboardMoney(row.amount)}</TableCell>
                  <TableCell>{row.date ? new Date(row.date).toLocaleString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
