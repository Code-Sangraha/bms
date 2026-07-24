"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import Modal from "@/app/components/Modal/Modal";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { getCreditors } from "@/handlers/creditor";
import {
  createItemSale,
  getInventoryItems,
  getItemSale,
  getItemSales,
  type InventoryItem,
  type ItemSalePaymentMethod,
  type ItemSalePaymentType,
  type ItemSaleUnitType,
} from "@/handlers/itemInventory";
import { inventoryQueryKeys, invalidateInventoryCaches } from "./inventoryQueries";
import { useInventoryScope } from "./InventoryScope";

type CartLine = {
  key: string;
  item: InventoryItem;
  unitType: ItemSaleUnitType;
  quantity: string;
  unitPrice: string;
};

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function configuredPrice(item: InventoryItem, unitType: ItemSaleUnitType) {
  return unitType === "SECONDARY" ? item.secondarySellingPrice ?? 0 : item.sellingPrice;
}

export default function SalesTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { outletId } = useInventoryScope();
  const queryClient = useQueryClient();
  const [saleOpen, setSaleOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [paymentType, setPaymentType] = useState<ItemSalePaymentType>("PAID");
  const [paymentMethod, setPaymentMethod] = useState<ItemSalePaymentMethod>("CASH");
  const [creditorId, setCreditorId] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const itemsQuery = useQuery({
    queryKey: inventoryQueryKeys.items(outletId),
    queryFn: async () => {
      const result = await getInventoryItems(outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data.filter((item) => item.status && item.quantity > 0);
    },
  });
  const salesQuery = useQuery({
    queryKey: ["item-inventory", "sales"],
    queryFn: async () => {
      const result = await getItemSales();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const creditorsQuery = useQuery({
    queryKey: ["creditors", "item-sale"],
    enabled: paymentType === "CREDIT" && saleOpen,
    queryFn: async () => {
      const result = await getCreditors();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const detailQuery = useQuery({
    queryKey: ["item-inventory", "sales", detailId],
    enabled: Boolean(detailId),
    queryFn: async () => {
      const result = await getItemSale(detailId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  const total = useMemo(() => cart.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const price = Number(line.unitPrice);
    return sum + (Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0);
  }, 0), [cart]);

  const addLine = () => {
    const item = itemsQuery.data?.find((row) => row.id === selectedItemId);
    if (!item) return;
    setCart((current) => [...current, {
      key: `${item.id}-${Date.now()}`,
      item,
      unitType: "PRIMARY",
      quantity: "1",
      unitPrice: String(item.sellingPrice),
    }]);
    setSelectedItemId("");
  };
  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setCart((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, ...patch };
      if (patch.unitType) next.unitPrice = String(configuredPrice(line.item, patch.unitType));
      return next;
    }));
  };
  const resetSale = () => {
    setCart([]); setCustomerName(""); setCustomerContact(""); setPaymentType("PAID");
    setPaymentMethod("CASH"); setCreditorId(""); setNote(""); setFormError(null); setSaleOpen(false);
  };
  const mutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (!cart.length) throw new Error(t("Add at least one item."));
      if (paymentType === "CREDIT" && !creditorId) throw new Error(t("Select a creditor for a credit sale."));
      const lines = cart.map((line) => {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const available = line.unitType === "SECONDARY"
          ? line.item.quantity * (line.item.conversionRate ?? 0)
          : line.item.quantity;
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${line.item.name}: ${t("Quantity must be greater than zero.")}`);
        if (quantity > available) throw new Error(`${line.item.name}: ${t("Insufficient stock")}`);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`${line.item.name}: ${t("Enter a valid unit price.")}`);
        return { itemId: line.item.id, unitType: line.unitType, quantity, unitPrice };
      });
      const result = await createItemSale({
        customerName: customerName.trim() || undefined,
        customerContact: customerContact.trim() || undefined,
        paymentType,
        paymentMethod: paymentType === "PAID" ? paymentMethod : undefined,
        creditorId: paymentType === "CREDIT" ? creditorId : undefined,
        note: note.trim() || undefined,
        items: lines,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["item-inventory", "sales"] }),
        invalidateInventoryCaches(queryClient, outletId, ["items", "movements", "openingClosing"]),
        queryClient.invalidateQueries({ queryKey: ["creditors"] }),
      ]);
      resetSale();
      showToast(t("Item sale created."), "success");
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : t("Failed to create item sale.")),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setSaleOpen(true)}><ShoppingCart className="h-4 w-4" />{t("New item sale")}</Button></div>
      {salesQuery.isLoading ? <TableSkeleton columns={6} /> : null}
      {salesQuery.isError ? <ErrorState title={t("Failed to load item sales")} description={salesQuery.error instanceof Error ? salesQuery.error.message : undefined} /> : null}
      {!salesQuery.isLoading && !salesQuery.isError && !salesQuery.data?.length ? <EmptyState title={t("No item sales yet.")} /> : null}
      {(salesQuery.data?.length ?? 0) > 0 ? <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>{t("Transaction")}</TableHead><TableHead>{t("Customer")}</TableHead><TableHead>{t("Payment")}</TableHead><TableHead>{t("Items")}</TableHead><TableHead className="text-right">{t("Total")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{salesQuery.data?.map((sale) => <TableRow key={sale.id}><TableCell><div className="font-medium">{sale.transactionId}</div><div className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleString("en-NP")}</div></TableCell><TableCell>{sale.customerName || t("Walk-in Customer")}</TableCell><TableCell><Badge variant={sale.paymentType === "CREDIT" ? "warning" : "success"}>{sale.paymentType}</Badge><div className="text-xs text-muted-foreground">{sale.paymentMethod ?? sale.creditor?.name}</div></TableCell><TableCell>{sale.lines.length}</TableCell><TableCell className="text-right font-medium">{npr.format(sale.totalAmount)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => setDetailId(sale.id)}>{t("View")}</Button></TableCell></TableRow>)}</TableBody></Table></div> : null}

      <Modal isOpen={saleOpen} onClose={() => { if (!mutation.isPending) resetSale(); }} title={t("New item sale")} subtitle={t("Stock is deducted automatically when the sale succeeds.")} modalClassName="sm:max-w-4xl">
        <div className="space-y-5">
          <div className="flex gap-2"><select className={selectClass} value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}><option value="">{t("Select inventory item")}</option>{itemsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit.symbol}</option>)}</select><Button type="button" variant="outline" onClick={addLine} disabled={!selectedItemId}><Plus className="h-4 w-4" />{t("Add")}</Button></div>
          {!cart.length ? <Card className="p-4 text-sm text-muted-foreground">{t("Add items to begin the sale.")}</Card> : <div className="space-y-3">{cart.map((line) => {
            const canUseSecondary = Boolean(line.item.secondaryUnit && line.item.conversionRate && line.item.secondarySellingPrice != null);
            const symbol = line.unitType === "SECONDARY" ? line.item.secondaryUnit?.symbol : line.item.unit.symbol;
            return <Card key={line.key} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_9rem_auto] sm:items-start">
              <div className="space-y-1.5">
                <Label>{t("Item")}</Label>
                <div className="flex h-10 flex-col justify-center">
                  <strong className="truncate leading-tight">{line.item.name}</strong>
                  <p className="truncate text-xs text-muted-foreground">{t("Available")}: {line.item.quantity} {line.item.unit.symbol}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Unit")}</Label>
                <select className={selectClass} value={line.unitType} onChange={(event) => updateLine(line.key, { unitType: event.target.value as ItemSaleUnitType })}><option value="PRIMARY">{line.item.unit.symbol}</option>{canUseSecondary ? <option value="SECONDARY">{line.item.secondaryUnit?.symbol}</option> : null}</select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Quantity")} <span className="font-normal text-muted-foreground">({symbol})</span></Label>
                <Input className="h-10" type="number" min="0" step="any" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Unit price")}</Label>
                <Input className="h-10" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
              </div>
              <Button className="mt-6" variant="ghost" size="icon" aria-label={t("Remove item")} onClick={() => setCart((current) => current.filter((row) => row.key !== line.key))}><Trash2 className="h-4 w-4" /></Button>
            </Card>;
          })}</div>}
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>{t("Customer name")}</Label><Input value={customerName} maxLength={150} onChange={(event) => setCustomerName(event.target.value)} /></div><div><Label>{t("Customer contact")}</Label><Input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} /></div><div><Label>{t("Payment type")}</Label><select className={selectClass} value={paymentType} onChange={(event) => setPaymentType(event.target.value as ItemSalePaymentType)}><option value="PAID">{t("Paid")}</option><option value="CREDIT">{t("Credit")}</option></select></div>{paymentType === "PAID" ? <div><Label>{t("Payment method")}</Label><select className={selectClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as ItemSalePaymentMethod)}><option value="CASH">{t("Cash")}</option><option value="ONLINE">{t("Online")}</option><option value="CHEQUE">{t("Cheque")}</option></select></div> : <div><Label>{t("Creditor")}</Label><select className={selectClass} value={creditorId} onChange={(event) => setCreditorId(event.target.value)}><option value="">{t("Select creditor")}</option>{creditorsQuery.data?.map((creditor) => <option key={creditor.id} value={creditor.id}>{creditor.name} · {creditor.phone}</option>)}</select></div>}</div>
          <div><Label>{t("Note")}</Label><Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex items-center justify-between border-t pt-4"><strong>{t("Total")}: {npr.format(total)}</strong><div className="flex gap-2"><Button variant="outline" onClick={resetSale} disabled={mutation.isPending}>{t("Cancel")}</Button><Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !cart.length}>{mutation.isPending ? t("Saving...") : t("Complete sale")}</Button></div></div>
        </div>
      </Modal>

      <Modal isOpen={detailId != null} onClose={() => setDetailId(null)} title={t("Item sale details")} subtitle={detailQuery.data?.transactionId}>
        {detailQuery.isLoading ? <TableSkeleton columns={4} /> : detailQuery.isError ? <ErrorState description={detailQuery.error instanceof Error ? detailQuery.error.message : undefined} /> : detailQuery.data ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">{t("Customer")}</span><p>{detailQuery.data.customerName || t("Walk-in Customer")}</p></div><div><span className="text-muted-foreground">{t("Payment")}</span><p>{detailQuery.data.paymentType} · {detailQuery.data.paymentMethod ?? detailQuery.data.creditor?.name}</p></div></div>{detailQuery.data.lines.map((line) => <Card key={line.id} className="flex justify-between gap-3 p-3"><div><strong>{line.item.name}</strong><p className="text-xs text-muted-foreground">{line.quantity} {line.unitType === "SECONDARY" ? line.item.secondaryUnit?.symbol : line.item.unit.symbol} × {npr.format(line.unitPrice)}</p></div><strong>{npr.format(line.amount)}</strong></Card>)}<div className="text-right text-lg font-semibold">{t("Total")}: {npr.format(detailQuery.data.totalAmount)}</div></div> : null}
      </Modal>
    </div>
  );
}
