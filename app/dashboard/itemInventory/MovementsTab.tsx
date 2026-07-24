"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Pagination from "@/app/components/Pagination/Pagination";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { paginate, usePagination } from "@/app/hooks/usePagination";
import { useI18n } from "@/app/providers/I18nProvider";
import { getInventoryHistory, getInventoryItems, type InventoryMovement } from "@/handlers/itemInventory";
import { formatNepalDateTime, getLastNepalCalendarDays, inclusiveNepalRangeToIso } from "@/lib/nepalTime";
import { filterAndSortMovements, type MovementSort } from "./inventoryFilters";
import { inventoryQueryKeys } from "./inventoryQueries";
import { useInventoryScope } from "./InventoryScope";

const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring";
const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });

function movementSign(row: InventoryMovement): number {
  const type = row.type.toUpperCase();
  if (type === "DEDUCT") return -Math.abs(row.quantity);
  if (type === "RESTOCK" || type === "OPENING") return Math.abs(row.quantity);
  return row.quantity;
}

function MovementBadge({ type }: { type: string }) {
  const upper = type.toUpperCase();
  const variant = upper === "DEDUCT" ? "destructive" : upper === "OPENING" ? "info" : "success";
  return <Badge variant={variant}>{upper}</Badge>;
}

export default function MovementsTab() {
  const { t, locale } = useI18n();
  const { outletId } = useInventoryScope();
  const initial = useMemo(() => getLastNepalCalendarDays(30), []);
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [itemId, setItemId] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MovementSort>("newest");
  const range = useMemo(() => inclusiveNepalRangeToIso(fromDate, toDate), [fromDate, toDate]);

  const itemsQuery = useQuery({
    queryKey: inventoryQueryKeys.items(outletId),
    queryFn: async () => {
      const result = await getInventoryItems(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const movementsQuery = useQuery({
    queryKey: [...inventoryQueryKeys.movements(outletId), itemId, range?.from, range?.to],
    enabled: range != null,
    queryFn: async () => {
      if (!range) return [];
      const result = await getInventoryHistory(outletId, {
        itemId: itemId === "all" ? undefined : itemId,
        from: range.from,
        to: range.to,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const filtered = useMemo(
    () => filterAndSortMovements(movementsQuery.data ?? [], { search, type, sort }),
    [movementsQuery.data, search, sort, type]
  );
  const pagination = usePagination(filtered.length, { defaultPageSize: 20 });
  const rows = useMemo(
    () => paginate(filtered, pagination.startIndex, pagination.endIndex),
    [filtered, pagination.endIndex, pagination.startIndex]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-xs font-medium"><span>{t("From")}</span><Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium"><span>{t("To")}</span><Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium"><span>{t("Item")}</span><select className={`${selectClass} w-full`} value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="all">{t("All items")}</option>{(itemsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="space-y-1 text-xs font-medium"><span>{t("Movement type")}</span><select className={`${selectClass} w-full`} value={type} onChange={(event) => setType(event.target.value)}><option value="all">{t("All movements")}</option><option value="OPENING">{t("Opening")}</option><option value="RESTOCK">{t("Restock")}</option><option value="DEDUCT">{t("Deduct")}</option><option value="ADJUSTMENT">{t("Adjustment")}</option></select></label>
          <label className="space-y-1 text-xs font-medium"><span>{t("Sort")}</span><select className={`${selectClass} w-full`} value={sort} onChange={(event) => setSort(event.target.value as MovementSort)}><option value="newest">{t("Newest first")}</option><option value="oldest">{t("Oldest first")}</option><option value="quantity-desc">{t("Quantity: high first")}</option><option value="quantity-asc">{t("Quantity: low first")}</option></select></label>
          <label className="space-y-1 text-xs font-medium"><span>{t("Search")}</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={t("Item or note")} /></span></label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("The visible end date is included. The API receives the next Nepal day as the exclusive boundary.")}</p>
      </div>

      {!range ? <Alert variant="destructive"><AlertDescription>{t("Choose a valid date range with the start before or equal to the end.")}</AlertDescription></Alert> : null}
      {movementsQuery.isLoading ? <TableSkeleton rows={8} columns={7} /> : null}
      {movementsQuery.isError ? <ErrorState title={t("Failed to load movements")} description={movementsQuery.error instanceof Error ? movementsQuery.error.message : undefined} /> : null}
      {range && !movementsQuery.isLoading && !movementsQuery.isError && filtered.length === 0 ? <EmptyState title={t("No movements match this range.")} /> : null}

      {filtered.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
            <Table>
              <TableHeader><TableRow><TableHead>{t("Date and time")}</TableHead><TableHead>{t("Item")}</TableHead><TableHead>{t("Type")}</TableHead><TableHead>{t("Change")}</TableHead><TableHead>{t("Resulting stock")}</TableHead><TableHead>{t("Prices")}</TableHead><TableHead>{t("Note")}</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((row) => {
                const signed = movementSign(row);
                return <TableRow key={row.id}><TableCell className="whitespace-nowrap text-xs">{formatNepalDateTime(row.createdAt, locale === "ne" ? "ne-NP" : "en-NP")}</TableCell><TableCell><div className="font-medium">{row.item.name}</div><div className="text-xs text-muted-foreground">{row.item.category.name} · {row.item.unit.symbol}</div></TableCell><TableCell><MovementBadge type={row.type} /></TableCell><TableCell className={`font-semibold tabular-nums ${signed < 0 ? "text-destructive" : "text-emerald-700"}`}>{signed > 0 ? "+" : ""}{signed} {row.item.unit.symbol}</TableCell><TableCell className="tabular-nums">{row.resultingQuantity} {row.item.unit.symbol}</TableCell><TableCell className="text-xs">{row.buyingPrice != null ? `${t("Buy")}: ${npr.format(row.buyingPrice)}` : "—"}<br />{row.sellingPrice != null ? `${t("Sell")}: ${npr.format(row.sellingPrice)}` : ""}</TableCell><TableCell className="max-w-[16rem] whitespace-normal text-xs">{row.note || "—"}</TableCell></TableRow>;
              })}</TableBody>
            </Table>
          </div>
          <div className="space-y-3 lg:hidden">{rows.map((row) => {
            const signed = movementSign(row);
            return <Card key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{row.item.name}</h3><p className="text-xs text-muted-foreground">{formatNepalDateTime(row.createdAt, locale === "ne" ? "ne-NP" : "en-NP")}</p></div><MovementBadge type={row.type} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-muted-foreground">{t("Change")}</span><strong className={signed < 0 ? "text-destructive" : "text-emerald-700"}>{signed > 0 ? "+" : ""}{signed} {row.item.unit.symbol}</strong></div><div><span className="block text-xs text-muted-foreground">{t("Resulting stock")}</span>{row.resultingQuantity} {row.item.unit.symbol}</div><div><span className="block text-xs text-muted-foreground">{t("Category")}</span>{row.item.category.name}</div><div><span className="block text-xs text-muted-foreground">{t("Prices")}</span>{row.buyingPrice != null ? npr.format(row.buyingPrice) : "—"}</div></div>{row.note ? <p className="mt-3 rounded-md bg-muted/50 p-2 text-xs">{row.note}</p> : null}</Card>;
          })}</div>
          <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={filtered.length} pageSize={pagination.pageSize} onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize} pageSizeOptions={[20, 50, 100]} />
        </>
      ) : null}
    </div>
  );
}
