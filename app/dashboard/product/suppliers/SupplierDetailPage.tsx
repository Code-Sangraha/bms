"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import Modal from "@/app/components/Modal/Modal";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { PageHeader } from "@/app/components/ui-ext/PageHeader";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  getSupplierDetails,
  getSupplierPurchases,
  recordSupplierPayment,
  type SupplierPaymentStatus,
  type SupplierPurchase,
  type SupplierPurchaseType,
} from "@/handlers/supplier";
import { readOutletScopeFromSearch } from "@/lib/outletScope";

const npr = new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
const purchaseLabels: Record<SupplierPurchaseType, string> = {
  ITEM_ADD: "Item opening stock", ITEM_RESTOCK: "Item restock",
  LIVESTOCK_ADD: "Livestock purchase", LIVESTOCK_RESTOCK: "Livestock restock",
};

export default function SupplierDetailPage() {
  const { supplierId = "" } = useParams();
  const location = useLocation();
  const outletId = readOutletScopeFromSearch(location.search) ?? undefined;
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = useState("");
  const [purchaseType, setPurchaseType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentPurchase, setPaymentPurchase] = useState<SupplierPurchase | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const detailsKey = ["supplier", supplierId, outletId ?? "all"] as const;
  const purchasesKey = ["supplier-purchases", supplierId, outletId ?? "all", paymentStatus, purchaseType, from, to] as const;

  const detailsQuery = useQuery({
    queryKey: detailsKey,
    queryFn: async () => {
      const result = await getSupplierDetails(supplierId, outletId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const purchasesQuery = useQuery({
    queryKey: purchasesKey,
    queryFn: async () => {
      const result = await getSupplierPurchases(supplierId, {
        outletId,
        paymentStatus: paymentStatus as SupplierPaymentStatus || undefined,
        purchaseType: purchaseType as SupplierPurchaseType || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentPurchase) throw new Error(t("No purchase selected."));
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error(t("Enter a positive payment amount."));
      if (value > paymentPurchase.dueAmount) throw new Error(t("Payment cannot exceed the due amount."));
      const result = await recordSupplierPayment(supplierId, paymentPurchase.id, { amount: value });
      if (!result.ok || result.data.success === false) throw new Error(result.ok ? result.data.message ?? t("Payment failed.") : result.error);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-purchases", supplierId] }),
        queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
      ]);
      setPaymentPurchase(null); setAmount(""); setPaymentError(null);
      showToast(t("Supplier payment recorded."), "success");
    },
    onError: (error) => setPaymentError(error instanceof Error ? error.message : t("Payment failed.")),
  });
  const summary = purchasesQuery.data?.summary ?? detailsQuery.data?.summary;
  const rows = purchasesQuery.data?.purchases ?? [];
  const backUrl = useMemo(() => `/dashboard/product/suppliers${location.search}`, [location.search]);

  if (detailsQuery.isLoading) return <div className="p-6"><TableSkeleton columns={5} /></div>;
  if (detailsQuery.isError) return <div className="p-6"><ErrorState title={t("Failed to load supplier")} description={detailsQuery.error instanceof Error ? detailsQuery.error.message : undefined} /></div>;
  const supplier = detailsQuery.data;
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <PageHeader title={supplier?.name ?? t("Supplier")} subtitle={`${supplier?.contact ?? t("No contact")} · ${supplier?.outlet?.name ?? t("Outlet")}`} actions={<Button asChild variant="outline"><Link to={backUrl}><ArrowLeft className="h-4 w-4" />{t("Back")}</Link></Button>} />
      {summary ? <div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-muted-foreground">{t("Purchased")}</p><strong>{npr.format(summary.totalPurchasedAmount)}</strong></Card><Card className="p-4"><p className="text-xs text-muted-foreground">{t("Paid")}</p><strong className="text-emerald-700">{npr.format(summary.totalPaidAmount)}</strong></Card><Card className="p-4"><p className="text-xs text-muted-foreground">{t("Due")}</p><strong className="text-destructive">{npr.format(summary.totalDueAmount)}</strong></Card></div> : null}
      <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-4">
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="">{t("All payment statuses")}</option><option value="ADVANCE">{t("Advance")}</option><option value="PARTIAL">{t("Partial")}</option><option value="FULL">{t("Full")}</option></select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}><option value="">{t("All purchase types")}</option>{Object.entries(purchaseLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("From")} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("To")} />
      </div>
      {purchasesQuery.isLoading ? <TableSkeleton columns={7} /> : purchasesQuery.isError ? <ErrorState title={t("Failed to load purchases")} description={purchasesQuery.error instanceof Error ? purchasesQuery.error.message : undefined} /> : rows.length === 0 ? <EmptyState title={t("No supplier purchases match these filters.")} /> : (
        <div className="overflow-x-auto rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>{t("Date")}</TableHead><TableHead>{t("Purchase")}</TableHead><TableHead>{t("Total")}</TableHead><TableHead>{t("Paid")}</TableHead><TableHead>{t("Due")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-NP") : "—"}</TableCell><TableCell><div className="font-medium">{row.inventoryItem?.name ?? row.livestockItem?.name ?? t("Purchase")}</div><div className="text-xs text-muted-foreground">{row.purchaseType ? t(purchaseLabels[row.purchaseType]) : "—"}</div></TableCell><TableCell>{npr.format(row.totalAmount)}</TableCell><TableCell>{npr.format(row.paidAmount)}</TableCell><TableCell>{npr.format(row.dueAmount)}</TableCell><TableCell><Badge variant={row.dueAmount > 0 ? "warning" : "success"}>{row.paymentStatus}</Badge></TableCell><TableCell>{row.dueAmount > 0 ? <Button size="sm" onClick={() => { setPaymentPurchase(row); setAmount(""); setPaymentError(null); }}>{t("Record payment")}</Button> : null}</TableCell></TableRow>)}</TableBody></Table></div>
      )}
      <Modal isOpen={paymentPurchase != null} title={t("Record supplier payment")} subtitle={paymentPurchase ? `${t("Due")}: ${npr.format(paymentPurchase.dueAmount)}` : undefined} onClose={() => { if (!paymentMutation.isPending) setPaymentPurchase(null); }}>
        <div className="space-y-4"><Input type="number" min="0.01" step="0.01" max={paymentPurchase?.dueAmount} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />{paymentError ? <p className="text-sm text-destructive">{paymentError}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPaymentPurchase(null)} disabled={paymentMutation.isPending}>{t("Cancel")}</Button><Button onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>{paymentMutation.isPending ? t("Saving...") : t("Record payment")}</Button></div></div>
      </Modal>
    </section>
  );
}
