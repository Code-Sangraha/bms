"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Modal from "@/app/components/Modal/Modal";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { useI18n } from "@/app/providers/I18nProvider";
import type {
  CreateItemPayload,
  InventoryItem,
  InventoryUnit,
  ItemCategory,
  StockChangePayload,
  UpdateItemPayload,
} from "@/handlers/itemInventory";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function finiteNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

type ItemEditorProps = {
  open: boolean;
  item: InventoryItem | null;
  categories: ItemCategory[];
  units: InventoryUnit[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateItemPayload | UpdateItemPayload) => Promise<string | null>;
};

export function ItemEditor({
  open,
  item,
  categories,
  units,
  pending,
  onClose,
  onSubmit,
}: ItemEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((row) => row.status || row.id === item?.category.id),
    [categories, item]
  );
  const activeUnits = useMemo(
    () => units.filter((row) => row.status || row.id === item?.unit.id),
    [item, units]
  );

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setCategoryId(item?.category.id ?? activeCategories[0]?.id ?? "");
    setUnitId(item?.unit.id ?? activeUnits[0]?.id ?? "");
    setQuantity(item ? "0" : "0");
    setBuyingPrice(item ? String(item.buyingPrice) : "");
    setSellingPrice(item ? String(item.sellingPrice) : "");
    setThreshold(item ? String(item.lowStockAlertQuantity) : "0");
    setError(null);
  }, [activeCategories, activeUnits, item, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const buying = finiteNumber(buyingPrice);
    const selling = finiteNumber(sellingPrice);
    const lowStockAlertQuantity = finiteNumber(threshold);
    const startingQuantity = finiteNumber(quantity);
    if (!name.trim() || !categoryId || !unitId) {
      setError(t("Name, category, and unit are required."));
      return;
    }
    if (buying == null || selling == null || buying < 0 || selling < 0) {
      setError(t("Buying and selling prices must be valid non-negative numbers."));
      return;
    }
    if (lowStockAlertQuantity == null || lowStockAlertQuantity < 0) {
      setError(t("Low-stock threshold must be a valid non-negative number."));
      return;
    }
    if (!item && (startingQuantity == null || startingQuantity < 0)) {
      setError(t("Starting quantity must be a valid non-negative number."));
      return;
    }
    const payload = item
      ? {
          id: item.id,
          name: name.trim(),
          categoryId,
          unitId,
          buyingPrice: buying,
          sellingPrice: selling,
          lowStockAlertQuantity,
        }
      : {
          name: name.trim(),
          categoryId,
          unitId,
          quantity: startingQuantity as number,
          buyingPrice: buying,
          sellingPrice: selling,
          lowStockAlertQuantity,
        };
    const failure = await onSubmit(payload);
    if (failure) setError(failure);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t(item ? "Edit item" : "Add item")}
      subtitle={t(item ? "Quantity changes are recorded through restock or deduct." : "Create an outlet-scoped inventory item.")}
      modalClassName="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={pending}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="inventory-item-form" disabled={pending}>
            {pending ? t("Saving...") : t(item ? "Save item" : "Create item")}
          </Button>
        </>
      }
    >
      <form id="inventory-item-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <Alert variant="destructive"><AlertDescription className="whitespace-pre-line">{error}</AlertDescription></Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Item name")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />
          </Field>
          <Field label={t("Category")}>
            <select className={selectClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{t("Select category")}</option>
              {activeCategories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </Field>
          <Field label={t("Unit")}>
            <select className={selectClass} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="">{t("Select unit")}</option>
              {activeUnits.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.symbol})</option>)}
            </select>
          </Field>
          {!item ? (
            <Field label={t("Starting quantity")}>
              <Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
          ) : null}
          <Field label={t("Buying price (NPR)")}>
            <Input type="number" min="0" step="0.01" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} />
          </Field>
          <Field label={t("Selling price (NPR)")}>
            <Input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} />
          </Field>
          <Field label={t("Low-stock threshold")}>
            <Input type="number" min="0" step="any" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

type StockEditorProps = {
  open: boolean;
  mode: "restock" | "deduct";
  item: InventoryItem | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: StockChangePayload) => Promise<string | null>;
};

export function StockEditor({ open, mode, item, pending, onClose, onSubmit }: StockEditorProps) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const numericQuantity = finiteNumber(quantity);
  const projected = item && numericQuantity != null
    ? item.quantity + (mode === "restock" ? numericQuantity : -numericQuantity)
    : item?.quantity;

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setBuyingPrice("");
    setSellingPrice("");
    setNote("");
    setError(null);
  }, [mode, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    setError(null);
    const amount = finiteNumber(quantity);
    if (amount == null || amount <= 0) {
      setError(t("Quantity must be a finite number greater than zero."));
      return;
    }
    if (mode === "deduct" && amount > item.quantity) {
      setError(t("Insufficient stock"));
      return;
    }
    if (note.length > 500) {
      setError(t("Note cannot exceed 500 characters."));
      return;
    }
    const buying = finiteNumber(buyingPrice);
    const selling = finiteNumber(sellingPrice);
    if ((buyingPrice.trim() && (buying == null || buying < 0)) || (sellingPrice.trim() && (selling == null || selling < 0))) {
      setError(t("Prices must be valid non-negative numbers."));
      return;
    }
    const payload: StockChangePayload = { id: item.id, quantity: amount };
    if (buyingPrice.trim()) payload.buyingPrice = buying as number;
    if (sellingPrice.trim()) payload.sellingPrice = selling as number;
    if (note.trim()) payload.note = note.trim();
    const failure = await onSubmit(payload);
    if (failure) setError(failure);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t(mode === "restock" ? "Restock item" : "Deduct stock")}
      subtitle={item?.name}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={pending}>{t("Cancel")}</Button>
          <Button type="submit" form="inventory-stock-form" disabled={pending} variant={mode === "deduct" ? "destructive" : "default"}>
            {pending ? t("Saving...") : t(mode === "restock" ? "Confirm restock" : "Confirm deduction")}
          </Button>
        </>
      }
    >
      <form id="inventory-stock-form" onSubmit={submit} className="space-y-4">
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <div><span className="block text-xs text-muted-foreground">{t("Current stock")}</span><strong>{item?.quantity ?? 0} {item?.unit.symbol}</strong></div>
          <div><span className="block text-xs text-muted-foreground">{t("Projected stock")}</span><strong className={(projected ?? 0) < 0 ? "text-destructive" : ""}>{projected ?? 0} {item?.unit.symbol}</strong></div>
        </div>
        <Field label={t("Quantity")}>
          <Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("New buying price (optional)")}>
            <Input type="number" min="0" step="0.01" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} />
          </Field>
          <Field label={t("New selling price (optional)")}>
            <Input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-amber-700">{t("Any supplied price replaces the current item price.")}</p>
        <Field label={t("Note")} hint={`${note.length}/500`}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}