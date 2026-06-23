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
import type { LivestockSale } from "@/handlers/sale";

type DashboardLivestockTabProps = {
  livestockRevenue: number;
  livestockTransactions: number;
  livestockWeight: number;
  livestockQuantity: number;
  livestockSalesRows: LivestockSale[];
  t: (key: string) => string;
};

function getLivestockDisplay(sale: LivestockSale): string {
  const id = typeof sale.livestockItemId === "string" ? sale.livestockItemId : "";
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
  return id || "-";
}

export default function DashboardLivestockTab({
  livestockRevenue,
  livestockTransactions,
  livestockWeight,
  livestockQuantity,
  livestockSalesRows,
  t,
}: DashboardLivestockTabProps) {
  const kpiCards: KPICard[] = [
    {
      label: t("Livestock Revenue"),
      value: formatDashboardMoney(livestockRevenue),
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
      label: t("Livestock Transactions"),
      value: String(livestockTransactions),
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
      label: t("Livestock Weight Sold"),
      value: `${formatDashboardDecimal(livestockWeight)} kg`,
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
    {
      label: t("Livestock Quantity Sold"),
      value: formatDashboardDecimal(livestockQuantity),
      icon: ({ className }) => (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.97 17.04C2.43 17.58 2 18.48 2 20v2h20v-2c0-1.52-.43-2.42-.97-2.96" />
          <path d="m22 16-4.6-4.6a2 2 0 0 0-2.82 0L5.2 20.8" />
          <path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10" />
          <path d="M3 7h18" />
          <path d="M5 21h14" />
        </svg>
      ),
      toneClassName: "dashboardKPICardQuantity",
    },
  ];

  return (
    <div className="dashboardTabContent">
      <DashboardKPIGrid cards={kpiCards} />

      {livestockSalesRows.length === 0 && <EmptyState title={t("No livestock sales yet.")} />}

      {livestockSalesRows.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("Contact")}</TableHead>
                <TableHead>{t("Livestock Item")}</TableHead>
                <TableHead>{t("Quantity")}</TableHead>
                <TableHead>{t("Amount")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {livestockSalesRows.map((row: LivestockSale, index) => {
                const rowDate = row.createdAt ?? row.date;
                const quantity = row.quantity ?? row.itemQuantityOrWeight ?? row.weight;
                return (
                  <TableRow key={`${row.id ?? row.transactionId ?? "ls"}-${index}`}>
                    <TableCell>{row.name ?? "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{row.contact ?? "-"}</TableCell>
                    <TableCell>{getLivestockDisplay(row)}</TableCell>
                    <TableCell>
                      {typeof quantity === "number" ? formatDashboardDecimal(quantity) : "-"}
                    </TableCell>
                    <TableCell>
                      {typeof row.amount === "number" ? formatDashboardMoney(row.amount) : "-"}
                    </TableCell>
                    <TableCell>{rowDate ? new Date(rowDate).toLocaleString() : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
