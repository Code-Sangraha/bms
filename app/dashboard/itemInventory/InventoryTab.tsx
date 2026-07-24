"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, PackagePlus, Search } from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import Pagination from "@/app/components/Pagination/Pagination";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { Switch } from "@/app/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { usePagination, paginate } from "@/app/hooks/usePagination";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  createInventoryItem,
  deductInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  getInventoryUnits,
  getItemCategories,
  restockInventoryItem,
  updateInventoryItem,
  type CreateItemPayload,
  type InventoryItem,
  type StockChangePayload,
  type UpdateItemPayload,
} from "@/handlers/itemInventory";
import { getActiveSuppliers, type Supplier } from "@/handlers/supplier";
import { ItemEditor, StockEditor } from "./InventoryDialogs";
import { filterAndSortInventoryItems, getStockState, type InventorySort, type InventoryStatusFilter, type InventoryStockFilter } from "./inventoryFilters";
import { inventoryQueryKeys, invalidateInventoryCaches } from "./inventoryQueries";
import { useInventoryScope, type InventoryPermissions } from "./InventoryScope";

const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring";
const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });

function StockBadge({ item }: { item: InventoryItem }) {
  const { t } = useI18n();
  const state = getStockState(item);
  if (state === "out") return <Badge variant="destructive">{t("Out of stock")}</Badge>;
  if (state === "low") return <Badge variant="warning">{t("Low stock")}</Badge>;
  return <Badge variant="success">{t("In stock")}</Badge>;
}

function ItemActions({
  onEdit,
  onStock,
  onDelete,
  permissions,
}: {
  onEdit: () => void;
  onStock: (mode: "restock" | "deduct") => void;
  onDelete: () => void;
  permissions: InventoryPermissions;
}) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("More options")}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {permissions.update ? <DropdownMenuItem onSelect={onEdit}>{t("Edit item")}</DropdownMenuItem> : null}
        {permissions.restock ? <DropdownMenuItem onSelect={() => onStock("restock")}>{t("Restock")}</DropdownMenuItem> : null}
        {permissions.update ? <DropdownMenuItem onSelect={() => onStock("deduct")}>{t("Deduct")}</DropdownMenuItem> : null}
        {permissions.delete ? <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>{t("Delete")}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function InventoryTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { outletId, permissions } = useInventoryScope();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<InventoryStatusFilter>("all");
  const [stock, setStock] = useState<InventoryStockFilter>("all");
  const [sort, setSort] = useState<InventorySort>("name-asc");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  const [stockEditor, setStockEditor] = useState<{ item: InventoryItem; mode: "restock" | "deduct" } | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const itemsQuery = useQuery({
    queryKey: inventoryQueryKeys.items(outletId),
    queryFn: async () => {
      const result = await getInventoryItems(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const categoriesQuery = useQuery({
    queryKey: inventoryQueryKeys.categories(outletId),
    queryFn: async () => {
      const result = await getItemCategories(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", outletId],
    enabled: Boolean(outletId),
    queryFn: async () => {
      const result = await getActiveSuppliers(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const unitsQuery = useQuery({
    queryKey: inventoryQueryKeys.units(outletId),
    queryFn: async () => {
      const result = await getInventoryUnits(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const items = itemsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const suppliers: Supplier[] = suppliersQuery.data ?? [];
  const filtered = useMemo(
    () => filterAndSortInventoryItems(items, { search, categoryId, status, stock, sort }),
    [categoryId, items, search, sort, status, stock]
  );
  const pagination = usePagination(filtered.length, { defaultPageSize: 10 });
  const pageItems = useMemo(
    () => paginate(filtered, pagination.startIndex, pagination.endIndex),
    [filtered, pagination.endIndex, pagination.startIndex]
  );

  const itemMutation = useMutation({
    mutationFn: (payload: CreateItemPayload | UpdateItemPayload) =>
      "id" in payload ? updateInventoryItem(outletId, payload) : createInventoryItem(outletId, payload),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await invalidateInventoryCaches(queryClient, outletId, ["items", "movements", "openingClosing"]);
      await queryClient.invalidateQueries({ queryKey: ["outletExpenses"] });
      setItemEditorOpen(false);
      setEditingItem(null);
      showToast(t("Inventory item saved."), "success");
    },
  });
  const stockMutation = useMutation({
    mutationFn: ({ mode, payload }: { mode: "restock" | "deduct"; payload: StockChangePayload }) =>
      mode === "restock" ? restockInventoryItem(outletId, payload) : deductInventoryItem(outletId, payload),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await invalidateInventoryCaches(queryClient, outletId, ["items", "movements", "openingClosing"]);
      if (stockEditor?.mode === "restock") await queryClient.invalidateQueries({ queryKey: ["outletExpenses"] });
      setStockEditor(null);
      showToast(t("Stock updated."), "success");
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ item, checked }: { item: InventoryItem; checked: boolean }) =>
      updateInventoryItem(outletId, { id: item.id, status: checked }),
    onSuccess: async (result) => {
      if (result.ok) await invalidateInventoryCaches(queryClient, outletId, ["items"]);
      else showToast(result.error, "error");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInventoryItem(outletId, id),
    onSuccess: async (result) => {
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setDeleteItem(null);
      setDeleteError(null);
      await invalidateInventoryCaches(queryClient, outletId, ["items", "movements", "openingClosing"]);
      showToast(t("Inventory item deleted."), "success");
    },
  });

  const openNew = () => { setEditingItem(null); setItemEditorOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditingItem(item); setItemEditorOpen(true); };
  const submitItem = async (payload: CreateItemPayload | UpdateItemPayload) => {
    const result = await itemMutation.mutateAsync(payload);
    return result.ok ? null : result.error;
  };
  const submitStock = async (payload: StockChangePayload) => {
    if (!stockEditor) return t("No item selected.");
    const result = await stockMutation.mutateAsync({ mode: stockEditor.mode, payload });
    return result.ok ? null : result.error;
  };

  const lowCount = items.filter((item) => getStockState(item) === "low").length;
  const outCount = items.filter((item) => getStockState(item) === "out").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("Total items")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{items.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("Low stock")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{lowCount}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{t("Out of stock")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{outCount}</p></Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search items")} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <select aria-label={t("Category")} className={selectClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">{t("All categories")}</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <select aria-label={t("Status")} className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as InventoryStatusFilter)}>
            <option value="all">{t("All statuses")}</option><option value="active">{t("Active")}</option><option value="inactive">{t("Inactive")}</option>
          </select>
          <select aria-label={t("Stock status")} className={selectClass} value={stock} onChange={(event) => setStock(event.target.value as InventoryStockFilter)}>
            <option value="all">{t("All stock")}</option><option value="low">{t("Low stock")}</option><option value="out">{t("Out of stock")}</option>
          </select>
          <select aria-label={t("Sort")} className={selectClass} value={sort} onChange={(event) => setSort(event.target.value as InventorySort)}>
            <option value="name-asc">{t("Name A–Z")}</option><option value="name-desc">{t("Name Z–A")}</option><option value="quantity-asc">{t("Quantity: low first")}</option><option value="quantity-desc">{t("Quantity: high first")}</option>
          </select>
        </div>
        {permissions.create ? <Button onClick={openNew}><PackagePlus className="h-4 w-4" />{t("Add item")}</Button> : null}
      </div>

      {itemsQuery.isLoading ? <TableSkeleton rows={8} columns={7} /> : null}
      {itemsQuery.isError ? <ErrorState title={t("Failed to load inventory")} description={itemsQuery.error instanceof Error ? itemsQuery.error.message : undefined} /> : null}
      {!itemsQuery.isLoading && !itemsQuery.isError && filtered.length === 0 ? <EmptyState title={t("No inventory items match these filters.")} /> : null}

      {!itemsQuery.isLoading && !itemsQuery.isError && filtered.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader><TableRow><TableHead>{t("Item")}</TableHead><TableHead>{t("Quantity")}</TableHead><TableHead>{t("Buying price")}</TableHead><TableHead>{t("Selling price")}</TableHead><TableHead>{t("Stock status")}</TableHead><TableHead>{t("Active")}</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>{pageItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.category.name} · {t("Alert at")} {item.lowStockAlertQuantity} {item.unit.symbol}</div></TableCell>
                  <TableCell className="font-medium tabular-nums">{item.quantity} {item.unit.symbol}</TableCell>
                  <TableCell className="tabular-nums">{npr.format(item.buyingPrice)}</TableCell>
                  <TableCell className="tabular-nums">{npr.format(item.sellingPrice)}{item.secondaryUnit && item.secondarySellingPrice != null ? <div className="text-xs text-muted-foreground">{npr.format(item.secondarySellingPrice)} / {item.secondaryUnit.symbol}<br />1 {item.unit.symbol} = {item.conversionRate} {item.secondaryUnit.symbol}</div> : null}</TableCell>
                  <TableCell><StockBadge item={item} /></TableCell>
                  <TableCell><Switch disabled={!permissions.update} checked={item.status} onCheckedChange={(checked) => statusMutation.mutate({ item, checked })} aria-label={`${t("Active")}: ${item.name}`} /></TableCell>
                  <TableCell>{permissions.update || permissions.restock || permissions.delete ? <ItemActions permissions={permissions} onEdit={() => openEdit(item)} onStock={(mode) => setStockEditor({ item, mode })} onDelete={() => { setDeleteItem(item); setDeleteError(null); }} /> : null}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">{pageItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{item.name}</h3><p className="text-xs text-muted-foreground">{item.category.name}</p></div>{permissions.update || permissions.restock || permissions.delete ? <ItemActions permissions={permissions} onEdit={() => openEdit(item)} onStock={(mode) => setStockEditor({ item, mode })} onDelete={() => { setDeleteItem(item); setDeleteError(null); }} /> : null}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-muted-foreground">{t("Quantity")}</span><strong>{item.quantity} {item.unit.symbol}</strong></div><div><span className="block text-xs text-muted-foreground">{t("Threshold")}</span>{item.lowStockAlertQuantity} {item.unit.symbol}</div><div><span className="block text-xs text-muted-foreground">{t("Buying price")}</span>{npr.format(item.buyingPrice)}</div><div><span className="block text-xs text-muted-foreground">{t("Selling price")}</span>{npr.format(item.sellingPrice)}</div></div>
              {item.secondaryUnit && item.secondarySellingPrice != null ? <p className="mt-2 text-xs text-muted-foreground">{npr.format(item.secondarySellingPrice)} / {item.secondaryUnit.symbol} · 1 {item.unit.symbol} = {item.conversionRate} {item.secondaryUnit.symbol}</p> : null}
              <div className="mt-4 flex items-center justify-between"><StockBadge item={item} /><label className="flex items-center gap-2 text-xs"><Switch disabled={!permissions.update} checked={item.status} onCheckedChange={(checked) => statusMutation.mutate({ item, checked })} />{t("Active")}</label></div>
            </Card>
          ))}</div>
          <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalItems={filtered.length} pageSize={pagination.pageSize} onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize} pageSizeOptions={[10, 20, 50]} />
        </>
      ) : null}

      <ItemEditor open={itemEditorOpen} item={editingItem} categories={categories} units={units} suppliers={suppliers} pending={itemMutation.isPending} onClose={() => { setItemEditorOpen(false); setEditingItem(null); }} onSubmit={submitItem} />
      <StockEditor open={stockEditor != null} item={stockEditor?.item ?? null} mode={stockEditor?.mode ?? "restock"} suppliers={suppliers} pending={stockMutation.isPending} onClose={() => setStockEditor(null)} onSubmit={submitStock} />
      <ConfirmModal isOpen={deleteItem != null} title={t("Delete item")} message={deleteItem ? `${t("Delete")} “${deleteItem.name}”? ${deleteError ?? ""}` : ""} confirmLabel={t("Delete")} cancelLabel={t("Cancel")} variant="danger" loading={deleteMutation.isPending} onClose={() => setDeleteItem(null)} onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)} />
    </div>
  );
}
