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
import type { Supplier } from "@/handlers/supplier";
import { buildInventoryPurchasePayload } from "@/lib/billing/inventoryPurchase";

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
  suppliers: Supplier[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateItemPayload | UpdateItemPayload) => Promise<string | null>;
};

export function ItemEditor({
  open,
  item,
  categories,
  units,
  suppliers,
  pending,
  onClose,
  onSubmit,
}: ItemEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [secondaryUnitId, setSecondaryUnitId] = useState("");
  const [conversionRate, setConversionRate] = useState("");
  const [secondarySellingPrice, setSecondarySellingPrice] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [threshold, setThreshold] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState({ supplierId: "", supplierName: "", supplierContact: "", totalAmount: "", paidAmount: "", dueAmount: "", paymentStatus: "FULL", remarks: "" });
  const startingQuantity = finiteNumber(quantity);

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
    setSecondaryUnitId(item?.secondaryUnit?.id ?? "");
    setConversionRate(item?.conversionRate != null ? String(item.conversionRate) : "");
    setSecondarySellingPrice(item?.secondarySellingPrice != null ? String(item.secondarySellingPrice) : "");
    setQuantity(item ? "0" : "0");
    setBuyingPrice(item ? String(item.buyingPrice) : "");
    setSellingPrice(item ? String(item.sellingPrice) : "");
    setThreshold(item ? String(item.lowStockAlertQuantity) : "0");
    setError(null);
    setPurchase({ supplierId: "", supplierName: "", supplierContact: "", totalAmount: "", paidAmount: "", dueAmount: "", paymentStatus: "FULL", remarks: "" });
  }, [activeCategories, activeUnits, item, open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const buying = finiteNumber(buyingPrice);
    const selling = finiteNumber(sellingPrice);
    const lowStockAlertQuantity = finiteNumber(threshold);
    const startingQuantity = finiteNumber(quantity);
    const conversion = finiteNumber(conversionRate);
    const secondaryPrice = finiteNumber(secondarySellingPrice);
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
    const hasSecondary = Boolean(secondaryUnitId || conversionRate.trim() || secondarySellingPrice.trim());
    if (hasSecondary && (!secondaryUnitId || conversion == null || conversion <= 0 || secondaryPrice == null || secondaryPrice < 0)) {
      setError(t("Secondary unit, positive conversion rate, and secondary selling price must be provided together."));
      return;
    }
    if (secondaryUnitId && secondaryUnitId === unitId) {
      setError(t("Primary and secondary units must be different."));
      return;
    }
    const purchaseResult = !item
      ? buildInventoryPurchasePayload(purchase, { quantity: startingQuantity as number, buyingPrice: buying })
      : null;
    if (purchaseResult && !purchaseResult.ok) {
      setError(t(purchaseResult.error));
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
          ...(hasSecondary ? { secondaryUnitId, conversionRate: conversion as number, secondarySellingPrice: secondaryPrice as number } : {}),
        }
      : {
          name: name.trim(),
          categoryId,
          unitId,
          quantity: startingQuantity as number,
          buyingPrice: buying,
          sellingPrice: selling,
          lowStockAlertQuantity,
          ...(hasSecondary ? { secondaryUnitId, conversionRate: conversion as number, secondarySellingPrice: secondaryPrice as number } : {}),
          ...(purchaseResult?.ok ? purchaseResult.data : {}),
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
          <Field label={t("Secondary unit (optional)")} hint={t("Enable sales in a second measuring unit.")}>
            <select className={selectClass} value={secondaryUnitId} onChange={(event) => setSecondaryUnitId(event.target.value)}>
              <option value="">{t("No secondary unit")}</option>
              {activeUnits.filter((row) => row.id !== unitId).map((row) => <option key={row.id} value={row.id}>{row.name} ({row.symbol})</option>)}
            </select>
          </Field>
          <Field label={t("Conversion rate")} hint={t("Number of secondary units in one primary unit.")}>
            <Input type="number" min="0" step="any" value={conversionRate} onChange={(event) => setConversionRate(event.target.value)} disabled={!secondaryUnitId} />
          </Field>
          <Field label={t("Secondary selling price (NPR)")}>
            <Input type="number" min="0" step="0.01" value={secondarySellingPrice} onChange={(event) => setSecondarySellingPrice(event.target.value)} disabled={!secondaryUnitId} />
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
        {!item ? <div className="grid gap-4 sm:grid-cols-2"><Field label={t("Supplier")}><select className={selectClass} value={purchase.supplierId} onChange={(e) => { const supplierId = e.target.value; const supplier = suppliers.find((row) => row.id === supplierId); setPurchase({ ...purchase, supplierId, supplierName: supplier?.name ?? "", supplierContact: supplier?.contact ?? "" }); }}><option value="">{t("No supplier")}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.contact ? ` (${supplier.contact})` : ""}</option>)}</select></Field><Field label={t("Supplier name")}><Input value={purchase.supplierName} readOnly /></Field><Field label={t("Supplier contact")}><Input value={purchase.supplierContact} readOnly /></Field><Field label={t("Total amount")} hint={t("Defaults to quantity × buying price.")}><Input type="number" min="0" step="0.01" value={purchase.totalAmount || (startingQuantity != null && buyingPrice ? String(startingQuantity * (finiteNumber(buyingPrice) ?? 0)) : "")} onChange={(e) => setPurchase({ ...purchase, totalAmount: e.target.value })} /></Field><Field label={t("Paid amount")}><Input type="number" min="0" step="0.01" value={purchase.paidAmount} onChange={(e) => setPurchase({ ...purchase, paidAmount: e.target.value })} /></Field><Field label={t("Due amount")}><Input type="number" min="0" step="0.01" value={purchase.dueAmount} onChange={(e) => setPurchase({ ...purchase, dueAmount: e.target.value })} /></Field><Field label={t("Payment status")}><select className={selectClass} value={purchase.paymentStatus} onChange={(e) => setPurchase({ ...purchase, paymentStatus: e.target.value })}><option value="ADVANCE">Advance</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></Field></div> : null}
        {!item ? <Field label={t("Remarks")}><Textarea value={purchase.remarks} onChange={(e) => setPurchase({ ...purchase, remarks: e.target.value })} maxLength={500} rows={2} /></Field> : null}
      </form>
    </Modal>
  );
}

type StockEditorProps = {
  open: boolean;
  mode: "restock" | "deduct";
  item: InventoryItem | null;
  suppliers: Supplier[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: StockChangePayload) => Promise<string | null>;
};

export function StockEditor({ open, mode, item, suppliers, pending, onClose, onSubmit }: StockEditorProps) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState({ supplierId: "", supplierName: "", supplierContact: "", totalAmount: "", paidAmount: "", dueAmount: "", paymentStatus: "FULL", remarks: "" });
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
    setPurchase({ supplierId: "", supplierName: "", supplierContact: "", totalAmount: "", paidAmount: "", dueAmount: "", paymentStatus: "FULL", remarks: "" });
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
    if (mode === "restock") { const result = buildInventoryPurchasePayload(purchase, { quantity: amount, buyingPrice: buying ?? item.buyingPrice }); if (!result.ok) { setError(t(result.error)); return; } Object.assign(payload, result.data); }
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
        {mode === "restock" ? <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-dashed p-3"><Field label={t("Supplier")}><select className={selectClass} value={purchase.supplierId} onChange={(e) => { const supplierId = e.target.value; const supplier = suppliers.find((row) => row.id === supplierId); setPurchase({ ...purchase, supplierId, supplierName: supplier?.name ?? "", supplierContact: supplier?.contact ?? "" }); }}><option value="">{t("No supplier")}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.contact ? ` (${supplier.contact})` : ""}</option>)}</select></Field><Field label={t("Supplier name")}><Input value={purchase.supplierName} readOnly /></Field><Field label={t("Supplier contact")}><Input value={purchase.supplierContact} readOnly /></Field><Field label={t("Total amount")} hint={t("Defaults to quantity × buying price.")}><Input type="number" min="0" step="0.01" value={purchase.totalAmount || (numericQuantity != null ? String(numericQuantity * (finiteNumber(buyingPrice) ?? item?.buyingPrice ?? 0)) : "")} onChange={(e) => setPurchase({ ...purchase, totalAmount: e.target.value })} /></Field><Field label={t("Paid amount")}><Input type="number" min="0" step="0.01" value={purchase.paidAmount} onChange={(e) => setPurchase({ ...purchase, paidAmount: e.target.value })} /></Field><Field label={t("Due amount")}><Input type="number" min="0" step="0.01" value={purchase.dueAmount} onChange={(e) => setPurchase({ ...purchase, dueAmount: e.target.value })} /></Field><Field label={t("Payment status")}><select className={selectClass} value={purchase.paymentStatus} onChange={(e) => setPurchase({ ...purchase, paymentStatus: e.target.value })}><option value="ADVANCE">Advance</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></Field></div> : null}
        <Field label={t("Note")} hint={`${note.length}/500`}>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}
