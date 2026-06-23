"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { buildPathWithOutletScope } from "@/lib/outletScope";
import { formatDashboardMoney, formatDashboardDecimal } from "../utils/dashboardFormatting";
import type { ProcessedLineItem } from "../hooks/useDashboardData";
import type { LivestockSale } from "@/handlers/sale";
import type { LivestockExpenseHistoryEntry } from "@/lib/api/livestockExpenseHistory";

type MobileTabbedDetailsProps = {
  scopedOutletId: string | null;
  search: string;
  processedRows: ProcessedLineItem[];
  livestockSalesRows: LivestockSale[];
  dashboardExpenseRows: LivestockExpenseHistoryEntry[];
  canShowUnscopedLivestock: boolean;
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

export default function MobileTabbedDetails({
  scopedOutletId,
  search,
  processedRows,
  livestockSalesRows,
  dashboardExpenseRows,
  canShowUnscopedLivestock,
  t,
}: MobileTabbedDetailsProps) {
  const [activeTab, setActiveTab] = useState("processed");
  const to = (path: string) => buildPathWithOutletScope(path, scopedOutletId, search);

  return (
    <div className="mobileTabbedDetails">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mobileTabbedDetails__tabsList">
          <TabsTrigger value="processed">{t("Processed")}</TabsTrigger>
          {canShowUnscopedLivestock && (
            <TabsTrigger value="livestock">{t("Livestock")}</TabsTrigger>
          )}
          <TabsTrigger value="expenses">{t("Expenses")}</TabsTrigger>
        </TabsList>

        <TabsContent value="processed">
          <div className="mobileTabbedDetails__content">
            {processedRows.length === 0 ? (
              <p className="mobileTabbedDetails__empty">{t("No processed sales yet.")}</p>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Item")}</TableHead>
                        <TableHead>{t("Qty")}</TableHead>
                        <TableHead>{t("Amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedRows.slice(0, 5).map((row, index) => (
                        <TableRow key={`${row.transactionId}-${index}`}>
                          <TableCell className="mobileTableCell">
                            {row.productName || "-"}
                          </TableCell>
                          <TableCell className="mobileTableCell">
                            {formatDashboardDecimal(row.quantity || 0)}
                          </TableCell>
                          <TableCell className="mobileTableCell">
                            {formatDashboardMoney(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {processedRows.length > 5 && (
                  <Link to={to("/dashboard/invoices")} className="mobileTabbedDetails__viewAll">
                    {t("View All")} →
                  </Link>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {canShowUnscopedLivestock && (
          <TabsContent value="livestock">
            <div className="mobileTabbedDetails__content">
              {livestockSalesRows.length === 0 ? (
                <p className="mobileTabbedDetails__empty">{t("No livestock sales yet.")}</p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Item")}</TableHead>
                          <TableHead>{t("Qty")}</TableHead>
                          <TableHead>{t("Amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {livestockSalesRows.slice(0, 5).map((row, index) => {
                          const quantity = row.quantity ?? row.itemQuantityOrWeight ?? row.weight;
                          return (
                            <TableRow key={`${row.id ?? index}`}>
                              <TableCell className="mobileTableCell">
                                {getLivestockDisplay(row)}
                              </TableCell>
                              <TableCell className="mobileTableCell">
                                {typeof quantity === "number" ? formatDashboardDecimal(quantity) : "-"}
                              </TableCell>
                              <TableCell className="mobileTableCell">
                                {typeof row.amount === "number"
                                  ? formatDashboardMoney(row.amount)
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {livestockSalesRows.length > 5 && (
                    <Link
                      to={to("/dashboard/invoices/livestock-sales")}
                      className="mobileTabbedDetails__viewAll"
                    >
                      {t("View All")} →
                    </Link>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="expenses">
          <div className="mobileTabbedDetails__content">
            {dashboardExpenseRows.length === 0 ? (
              <p className="mobileTabbedDetails__empty">{t("No expenses yet.")}</p>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Item")}</TableHead>
                        <TableHead>{t("Paid")}</TableHead>
                        <TableHead>{t("Due")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboardExpenseRows.slice(0, 5).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="mobileTableCell">
                            {row.livestockItem.name}
                          </TableCell>
                          <TableCell className="mobileTableCell">
                            {formatDashboardMoney(row.paidAmount)}
                          </TableCell>
                          <TableCell className="mobileTableCell">
                            {formatDashboardMoney(row.dueAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {dashboardExpenseRows.length > 5 && (
                  <Link
                    to={to("/dashboard/outlets/expenses")}
                    className="mobileTabbedDetails__viewAll"
                  >
                    {t("View All")} →
                  </Link>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
