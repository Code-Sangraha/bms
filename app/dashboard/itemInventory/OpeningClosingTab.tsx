"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { useI18n } from "@/app/providers/I18nProvider";
import { getInventoryItems, getOpeningClosing } from "@/handlers/itemInventory";
import { getNepalDateKey } from "@/lib/nepalTime";
import { getNetMovement } from "./inventoryFilters";
import { inventoryQueryKeys } from "./inventoryQueries";
import { useInventoryScope } from "./InventoryScope";
import { useState } from "react";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring";

export default function OpeningClosingTab() {
  const { t } = useI18n();
  const { outletId } = useInventoryScope();
  const [date, setDate] = useState(() => getNepalDateKey());
  const [itemId, setItemId] = useState("all");
  const itemsQuery = useQuery({
    queryKey: inventoryQueryKeys.items(outletId),
    queryFn: async () => {
      const result = await getInventoryItems(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const rowsQuery = useQuery({
    queryKey: [...inventoryQueryKeys.openingClosing(outletId), date, itemId],
    enabled: Boolean(date),
    queryFn: async () => {
      const result = await getOpeningClosing(outletId, {
        date,
        itemId: itemId === "all" ? undefined : itemId,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const rows = rowsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end">
        <label className="space-y-1 text-xs font-medium"><span>{t("Nepal date")}</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="min-w-56 flex-1 space-y-1 text-xs font-medium"><span>{t("Item")}</span><select className={selectClass} value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="all">{t("All items")}</option>{(itemsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <p className="text-xs text-muted-foreground sm:max-w-sm">{t("Net movement is closing stock minus opening stock.")}</p>
      </div>
      {rowsQuery.isLoading ? <TableSkeleton rows={8} columns={7} /> : null}
      {rowsQuery.isError ? <ErrorState title={t("Failed to load opening and closing stock")} description={rowsQuery.error instanceof Error ? rowsQuery.error.message : undefined} /> : null}
      {!rowsQuery.isLoading && !rowsQuery.isError && rows.length === 0 ? <EmptyState title={t("No stock rows for this date.")} /> : null}
      {rows.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table><TableHeader><TableRow><TableHead>{t("Item")}</TableHead><TableHead>{t("Opening")}</TableHead><TableHead>{t("Restocked")}</TableHead><TableHead>{t("Deducted")}</TableHead><TableHead>{t("Closing")}</TableHead><TableHead>{t("Net movement")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
              const net = getNetMovement(row);
              return <TableRow key={row.itemId}><TableCell><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.category.name} · {row.unit.symbol}</div></TableCell><TableCell className="tabular-nums">{row.openingStock}</TableCell><TableCell className="tabular-nums text-emerald-700">+{row.restocked}</TableCell><TableCell className="tabular-nums text-destructive">-{row.deducted}</TableCell><TableCell className="font-semibold tabular-nums">{row.closingStock}</TableCell><TableCell className={`font-semibold tabular-nums ${net < 0 ? "text-destructive" : net > 0 ? "text-emerald-700" : ""}`}>{net > 0 ? "+" : ""}{net}</TableCell></TableRow>;
            })}</TableBody></Table>
          </div>
          <div className="space-y-3 md:hidden">{rows.map((row) => {
            const net = getNetMovement(row);
            return <Card key={row.itemId} className="p-4"><div><h3 className="font-semibold">{row.name}</h3><p className="text-xs text-muted-foreground">{row.category.name} · {row.unit.name}</p></div><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><span className="block text-xs text-muted-foreground">{t("Opening")}</span>{row.openingStock}</div><div><span className="block text-xs text-muted-foreground">{t("Restocked")}</span><span className="text-emerald-700">+{row.restocked}</span></div><div><span className="block text-xs text-muted-foreground">{t("Deducted")}</span><span className="text-destructive">-{row.deducted}</span></div><div><span className="block text-xs text-muted-foreground">{t("Closing")}</span><strong>{row.closingStock}</strong></div><div className="col-span-2"><span className="block text-xs text-muted-foreground">{t("Net movement")}</span><strong className={net < 0 ? "text-destructive" : "text-emerald-700"}>{net > 0 ? "+" : ""}{net} {row.unit.symbol}</strong></div></div></Card>;
          })}</div>
        </>
      ) : null}
    </div>
  );
}
