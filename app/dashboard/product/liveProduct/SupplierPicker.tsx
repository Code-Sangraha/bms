"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import Modal from "@/app/components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useI18n } from "@/app/providers/I18nProvider";
import { createSupplier, getActiveSuppliers, type Supplier } from "@/handlers/supplier";

type Props = {
  outletId: string | null;
  selectedSupplierId: string;
  disabled?: boolean;
  onSelect: (supplier: Supplier) => void;
};

export default function SupplierPicker({ outletId, selectedSupplierId, disabled, onSelect }: Props) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryKey = ["suppliers", outletId ?? "none"] as const;
  const suppliersQuery = useQuery({
    queryKey,
    enabled: Boolean(outletId),
    queryFn: async () => {
      const result = await getActiveSuppliers(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return suppliersQuery.data ?? [];
    return (suppliersQuery.data ?? []).filter((supplier) =>
      `${supplier.name} ${supplier.contact ?? ""}`.toLocaleLowerCase().includes(term)
    );
  }, [search, suppliersQuery.data]);
  const createMutation = useMutation({
    mutationFn: () => {
      if (!outletId) throw new Error(t("Select an outlet before creating a supplier."));
      if (!name.trim()) throw new Error(t("Supplier name is required."));
      if (!contact.trim()) throw new Error(t("Supplier contact is required."));
      return createSupplier({ name, contact, outletId });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey });
      const refreshed = await getActiveSuppliers(outletId);
      const created = refreshed.ok
        ? refreshed.data.find((supplier) =>
            supplier.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() &&
            supplier.contact?.trim() === contact.trim()
          )
        : null;
      if (created) onSelect(created);
      setCreateOpen(false);
      setName("");
      setContact("");
      setSearch("");
      setError(null);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : t("Failed to create supplier.")),
  });

  return (
    <div className="space-y-2">
      <Label>{t("Supplier")}</Label>
      {!outletId ? <p className="text-sm text-destructive">{t("Select an outlet to load suppliers.")}</p> : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search supplier name or contact")} className="pl-9" disabled={disabled} />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border bg-background">
            {suppliersQuery.isLoading ? <p className="p-3 text-sm text-muted-foreground">{t("Loading suppliers...")}</p> : null}
            {suppliersQuery.isError ? <p className="p-3 text-sm text-destructive">{suppliersQuery.error instanceof Error ? suppliersQuery.error.message : t("Failed to load suppliers.")}</p> : null}
            {!suppliersQuery.isLoading && filtered.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("No matching suppliers.")}</p> : null}
            {filtered.map((supplier) => (
              <button key={supplier.id} type="button" disabled={disabled} onClick={() => { onSelect(supplier); setSearch(supplier.name); }} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted">
                <span><strong className="block">{supplier.name}</strong><span className="text-xs text-muted-foreground">{supplier.contact || t("No contact")}</span></span>
                {supplier.id === selectedSupplierId ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => { setCreateOpen(true); setError(null); }} disabled={disabled}>
            <Plus className="h-4 w-4" />{t("Create new supplier")}
          </Button>
        </>
      )}
      <Modal isOpen={createOpen} onClose={() => { if (!createMutation.isPending) setCreateOpen(false); }} title={t("Create supplier")} subtitle={t("The new supplier will be selected automatically.")}>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>{t("Supplier name")}</Label><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label>{t("Supplier contact")}</Label><Input value={contact} onChange={(event) => setContact(event.target.value)} /></div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>{t("Cancel")}</Button><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>{createMutation.isPending ? t("Saving...") : t("Create supplier")}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
