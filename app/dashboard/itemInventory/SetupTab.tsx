"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import ConfirmModal from "@/app/components/Modal/ConfirmModal";
import Modal from "@/app/components/Modal/Modal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  createInventoryUnit,
  createItemCategory,
  deleteInventoryUnit,
  deleteItemCategory,
  getInventoryUnits,
  getItemCategories,
  updateInventoryUnit,
  updateItemCategory,
  type InventoryUnit,
  type ItemCategory,
} from "@/handlers/itemInventory";
import { inventoryQueryKeys, invalidateInventoryCaches } from "./inventoryQueries";
import { useInventoryScope } from "./InventoryScope";

type EditorState =
  | { kind: "category"; row: ItemCategory | null }
  | { kind: "unit"; row: InventoryUnit | null }
  | null;
type DeleteState =
  | { kind: "category"; row: ItemCategory }
  | { kind: "unit"; row: InventoryUnit }
  | null;

function SetupEditor({
  state,
  pending,
  onClose,
  onSubmit,
}: {
  state: EditorState;
  pending: boolean;
  onClose: () => void;
  onSubmit: (name: string, symbol: string) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!state) return;
    setName(state.row?.name ?? "");
    setSymbol(state.kind === "unit" ? state.row?.symbol ?? "" : "");
    setError(null);
  }, [state]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!state) return;
    if (!name.trim() || (state.kind === "unit" && !symbol.trim())) {
      setError(t("Complete all required fields."));
      return;
    }
    const failure = await onSubmit(name.trim(), symbol.trim());
    if (failure) setError(failure);
  };
  return (
    <Modal
      isOpen={state != null}
      onClose={onClose}
      title={t(`${state?.row ? "Edit" : "Create"} ${state?.kind ?? "category"}`)}
      footer={<><Button variant="outline" type="button" onClick={onClose} disabled={pending}>{t("Cancel")}</Button><Button type="submit" form="setup-editor-form" disabled={pending}>{pending ? t("Saving...") : t("Save")}</Button></>}
    >
      <form id="setup-editor-form" onSubmit={submit} className="space-y-4">
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="space-y-1.5"><Label>{t("Name")}</Label><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={100} /></div>
        {state?.kind === "unit" ? <div className="space-y-1.5"><Label>{t("Symbol")}</Label><Input value={symbol} onChange={(event) => setSymbol(event.target.value)} maxLength={20} placeholder={t("e.g. kg")} /></div> : null}
      </form>
    </Modal>
  );
}

function SectionHeader({ title, description, search, setSearch, addLabel, onAdd }: { title: string; description: string; search: string; setSearch: (value: string) => void; addLabel: string; onAdd?: () => void }) {
  const { t } = useI18n();
  return <div className="space-y-3 border-b p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div>{onAdd ? <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" />{addLabel}</Button> : null}</div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={t("Search")} /></div></div>;
}

export default function SetupTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { outletId, permissions } = useInventoryScope();
  const [categorySearch, setCategorySearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<DeleteState>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const categoriesQuery = useQuery({
    queryKey: inventoryQueryKeys.categories(outletId),
    queryFn: async () => { const result = await getItemCategories(outletId); if (!result.ok) throw new Error(result.error); return result.data; },
  });
  const unitsQuery = useQuery({
    queryKey: inventoryQueryKeys.units(outletId),
    queryFn: async () => { const result = await getInventoryUnits(outletId); if (!result.ok) throw new Error(result.error); return result.data; },
  });
  const categories = categoriesQuery.data ?? [];
  const units = unitsQuery.data ?? [];
  const filteredCategories = useMemo(() => categories.filter((row) => row.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase())), [categories, categorySearch]);
  const filteredUnits = useMemo(() => units.filter((row) => `${row.name} ${row.symbol}`.toLocaleLowerCase().includes(unitSearch.trim().toLocaleLowerCase())), [unitSearch, units]);

  const editorMutation = useMutation({
    mutationFn: ({ state, name, symbol }: { state: Exclude<EditorState, null>; name: string; symbol: string }) => {
      if (state.kind === "category") return state.row ? updateItemCategory(outletId, { id: state.row.id, name, status: state.row.status }) : createItemCategory(outletId, { name });
      return state.row ? updateInventoryUnit(outletId, { id: state.row.id, name, symbol, status: state.row.status }) : createInventoryUnit(outletId, { name, symbol });
    },
    onSuccess: async (result) => {
      if (!result.ok) return;
      await invalidateInventoryCaches(queryClient, outletId, ["categories", "units", "items"]);
      setEditor(null);
      showToast(t("Setup saved."), "success");
    },
  });
  const statusMutation = useMutation({
    mutationFn: (state: Exclude<DeleteState, null>) => state.kind === "category"
      ? updateItemCategory(outletId, { id: state.row.id, name: state.row.name, status: !state.row.status })
      : updateInventoryUnit(outletId, { id: state.row.id, name: state.row.name, symbol: state.row.symbol, status: !state.row.status }),
    onSuccess: async (result) => {
      if (result.ok) await invalidateInventoryCaches(queryClient, outletId, ["categories", "units", "items"]);
      else showToast(result.error, "error");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (state: Exclude<DeleteState, null>) => state.kind === "category" ? deleteItemCategory(outletId, state.row.id) : deleteInventoryUnit(outletId, state.row.id),
    onSuccess: async (result) => {
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      await invalidateInventoryCaches(queryClient, outletId, ["categories", "units", "items"]);
      setDeleting(null);
      setDeleteError(null);
      showToast(t("Setup entry deleted."), "success");
    },
  });

  const submitEditor = async (name: string, symbol: string) => {
    if (!editor) return t("Nothing selected.");
    const result = await editorMutation.mutateAsync({ state: editor, name, symbol });
    return result.ok ? null : result.error;
  };
  const openDelete = (state: Exclude<DeleteState, null>) => { setDeleting(state); setDeleteError(null); };

  const renderCategory = (row: ItemCategory) => <div key={row.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"><div className="min-w-0 flex-1"><p className="truncate font-medium">{row.name}</p><Badge variant={row.status ? "success" : "secondary"}>{t(row.status ? "Active" : "Inactive")}</Badge></div><Switch checked={row.status} onCheckedChange={() => statusMutation.mutate({ kind: "category", row })} aria-label={`${t("Active")}: ${row.name}`} /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("More options")}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditor({ kind: "category", row })}>{t("Edit")}</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => openDelete({ kind: "category", row })}>{t("Delete")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;
  const renderUnit = (row: InventoryUnit) => <div key={row.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"><div className="min-w-0 flex-1"><p className="truncate font-medium">{row.name} <span className="text-muted-foreground">({row.symbol})</span></p><Badge variant={row.status ? "success" : "secondary"}>{t(row.status ? "Active" : "Inactive")}</Badge></div><Switch checked={row.status} onCheckedChange={() => statusMutation.mutate({ kind: "unit", row })} aria-label={`${t("Active")}: ${row.name}`} /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("More options")}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditor({ kind: "unit", row })}>{t("Edit")}</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => openDelete({ kind: "unit", row })}>{t("Delete")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>;

  return (
    <div className="space-y-4">
      {(categoriesQuery.isError || unitsQuery.isError) ? <ErrorState title={t("Failed to load inventory setup")} description={(categoriesQuery.error ?? unitsQuery.error) instanceof Error ? String((categoriesQuery.error ?? unitsQuery.error)?.message) : undefined} /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden"><SectionHeader title={t("Categories")} description={t("Organize items and control which categories are available.")} search={categorySearch} setSearch={setCategorySearch} addLabel={t("Add category")} onAdd={permissions.create ? () => setEditor({ kind: "category", row: null }) : undefined} />{!categoriesQuery.isLoading && filteredCategories.length === 0 ? <div className="p-4"><EmptyState title={t("No categories found.")} /></div> : filteredCategories.map(renderCategory)}</Card>
        <Card className="overflow-hidden"><SectionHeader title={t("Units")} description={t("Define the names and symbols used for stock quantities.")} search={unitSearch} setSearch={setUnitSearch} addLabel={t("Add unit")} onAdd={permissions.create ? () => setEditor({ kind: "unit", row: null }) : undefined} />{!unitsQuery.isLoading && filteredUnits.length === 0 ? <div className="p-4"><EmptyState title={t("No units found.")} /></div> : filteredUnits.map(renderUnit)}</Card>
      </div>
      <SetupEditor state={editor} pending={editorMutation.isPending} onClose={() => setEditor(null)} onSubmit={submitEditor} />
      <ConfirmModal isOpen={deleting != null} title={t(deleting?.kind === "unit" ? "Delete unit" : "Delete category")} message={deleting ? `${t("Delete")} “${deleting.row.name}”? ${deleteError ?? ""}` : ""} confirmLabel={t("Delete")} cancelLabel={t("Cancel")} variant="danger" loading={deleteMutation.isPending} onClose={() => { setDeleting(null); setDeleteError(null); }} onConfirm={() => deleting && deleteMutation.mutate(deleting)} />
    </div>
  );
}
