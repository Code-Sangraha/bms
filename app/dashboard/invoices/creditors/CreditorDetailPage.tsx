"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Wallet } from "lucide-react";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import Modal from "@/app/components/Modal/Modal";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { FormField } from "@/app/components/ui-ext/FormField";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { PaymentMethodPicker } from "@/app/dashboard/invoices/components/PaymentMethodPicker";
import {
  getCreditorDetail,
  payCreditor,
  type CreditorOrder,
  type CreditorPayment,
} from "@/handlers/creditor";
import {
  paymentMethodLabel,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import "./creditors.scss";

const paymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  discountAmount: z.number().min(0, "Discount cannot be negative"),
  paymentMethod: z.enum(["cash", "online", "cheque"]),
  reference: z.string().max(300, "Reference is too long").optional(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

function formatMoney(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "Rs.0.00";
  return `Rs.${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString();
}

function sourceTypeBadgeVariant(sourceType: string | undefined) {
  switch ((sourceType ?? "").toUpperCase()) {
    case "POS":
      return "info" as const;
    case "LIVESTOCK":
      return "success" as const;
    case "WASTE":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function orderItemsCount(order: CreditorOrder): number {
  return Array.isArray(order.items) ? order.items.length : 0;
}

function orderItemSummary(order: CreditorOrder): string {
  if (!Array.isArray(order.items) || order.items.length === 0) return "—";
  return order.items
    .map((item) => {
      const name = typeof item.name === "string" ? item.name : "";
      const qty =
        typeof item.weight === "number"
          ? `${item.weight} kg`
          : typeof item.quantity === "number"
            ? `x${item.quantity}`
            : "";
      const amount =
        typeof item.amount === "number" ? formatMoney(item.amount) : "";
      return [name, qty, amount].filter(Boolean).join(" · ");
    })
    .join(", ");
}

export default function CreditorDetailPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { creditorId: creditorIdParam } = useParams<{ creditorId: string }>();
  const creditorId = creditorIdParam ? decodeURIComponent(creditorIdParam) : "";
  const [payOpen, setPayOpen] = useState(false);

  const queryKey = useMemo(() => ["creditor", creditorId] as const, [creditorId]);

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey,
    enabled: Boolean(creditorId),
    queryFn: async () => {
      const result = await getCreditorDetail(creditorId);
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        throw new Error(result.error);
      }
      return result.data;
    },
  });

  const paidAmount = useMemo(() => {
    if (!detail) return 0;
    return Math.max(0, detail.totalAmount - detail.pendingAmount);
  }, [detail]);

  const payForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      discountAmount: 0,
      paymentMethod: "cash",
      reference: "",
    },
  });

  const payMutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      payCreditor(creditorId, {
        amount: values.amount,
        discountAmount: values.discountAmount,
        paymentMethod: values.paymentMethod as SalePaymentMethod,
        reference: values.reference,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        setPayOpen(false);
        payForm.reset({ amount: 0, discountAmount: 0, paymentMethod: "cash", reference: "" });
        void queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({ queryKey: ["creditors"] });
        showToast(t("Payment recorded successfully."), "success");
      } else {
        if (result.status === 401) navigate("/login");
        else payForm.setError("root", { message: result.error });
      }
    },
    onError: () => {
      payForm.setError("root", {
        message: t("Something went wrong. Please try again."),
      });
    },
  });

  const onPaySubmit = (values: PaymentFormValues) => {
    payMutation.mutate(values);
  };

  const openPayModal = () => {
    payForm.reset({
      amount: detail?.pendingAmount ?? 0,
      discountAmount: 0,
      paymentMethod: "cash",
      reference: "",
    });
    setPayOpen(true);
  };

  return (
    <section className="creditorsPage">
      <div className="breadcrumb">
        <Link to="/dashboard/invoices/creditors">{t("Creditors")}</Link> {"›"}{" "}
        <span>{detail?.name ?? t("Details")}</span>
      </div>

      <div className="creditorsHeader">
        <div className="creditorsHeaderText">
          <Link
            to="/dashboard/invoices/creditors"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("Back to creditors")}
          </Link>
          <h1 className="pageTitle">{detail?.name ?? t("Creditor details")}</h1>
          <p className="pageSubtitle">
            {detail ? `${detail.phone}${detail.address ? ` · ${detail.address}` : ""}` : ""}
          </p>
        </div>
        {detail && detail.pendingAmount > 0 ? (
          <Button type="button" onClick={openPayModal}>
            <Wallet className="h-4 w-4" aria-hidden />
            {t("Record Payment")}
          </Button>
        ) : null}
      </div>

      {isLoading && <TableSkeleton rows={4} columns={4} />}
      {isError && (
        <ErrorState
          title={t("Failed to load creditor")}
          description={
            error instanceof Error
              ? error.message
              : t("We couldn't load this section. Please try again.")
          }
        />
      )}

      {detail && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs text-muted-foreground">{t("Total Amount")}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <strong className="text-lg">{formatMoney(detail.totalAmount)}</strong>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs text-muted-foreground">{t("Pending")}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <strong className="text-lg text-amber-700">{formatMoney(detail.pendingAmount)}</strong>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <span className="text-xs text-muted-foreground">{t("Paid")}</span>
              </CardHeader>
              <CardContent className="pt-0">
                <strong className="text-lg text-emerald-700">{formatMoney(paidAmount)}</strong>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="pageTitle text-base mb-2">{t("Order history")}</h2>
            {detail.orders.length === 0 ? (
              <EmptyState title={t("No orders yet.")} />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Date")}</TableHead>
                      <TableHead>{t("Type")}</TableHead>
                      <TableHead>{t("Transaction")}</TableHead>
                      <TableHead>{t("Outlet")}</TableHead>
                      <TableHead>{t("Items")}</TableHead>
                      <TableHead>{t("Amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.orders.map((order, index) => (
                      <TableRow key={order.id ?? order.sourceTransactionId ?? index}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sourceTypeBadgeVariant(order.sourceType)}>
                            {order.sourceType ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.sourceTransactionId ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.outlet?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground" title={orderItemSummary(order)}>
                          {orderItemsCount(order)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(order.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <h2 className="pageTitle text-base mb-2">{t("Payment history")}</h2>
            {detail.payments.length === 0 ? (
              <EmptyState title={t("No payments yet.")} />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Date")}</TableHead>
                      <TableHead>{t("Amount")}</TableHead>
                      <TableHead>{t("Discount")}</TableHead>
                      <TableHead>{t("Payment method")}</TableHead>
                      <TableHead>{t("Reference")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.payments.map((payment: CreditorPayment, index) => (
                      <TableRow key={payment.id ?? index}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(payment.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.discountAmount ? formatMoney(payment.discountAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.paymentMethod
                            ? t(paymentMethodLabel(payment.paymentMethod))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.reference || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={payOpen}
        title={t("Record Payment")}
        subtitle={detail?.name}
        onClose={() => setPayOpen(false)}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              form="creditor-pay-form"
              disabled={payMutation.isPending}
            >
              {payMutation.isPending ? t("Saving…") : t("Record Payment")}
            </Button>
          </>
        }
      >
        <form
          id="creditor-pay-form"
          onSubmit={payForm.handleSubmit(onPaySubmit)}
          className="flex flex-col gap-4"
        >
          {payForm.formState.errors.root?.message && (
            <Alert variant="destructive">
              <AlertDescription>{payForm.formState.errors.root.message}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Pending")}</span>
              <strong>{formatMoney(detail?.pendingAmount)}</strong>
            </div>
          </div>
          <FormField
            id="creditor-pay-amount"
            label={t("Amount")}
            required
            error={payForm.formState.errors.amount?.message}
          >
            <Input
              id="creditor-pay-amount"
              type="number"
              min={0}
              step="any"
              {...payForm.register("amount", { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            id="creditor-pay-discount"
            label={t("Discount (Rs.)")}
            error={payForm.formState.errors.discountAmount?.message}
          >
            <Input
              id="creditor-pay-discount"
              type="number"
              min={0}
              step="any"
              {...payForm.register("discountAmount", { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            id="creditor-pay-method"
            label={t("Payment method")}
            required
          >
            <PaymentMethodPicker
              labelId="creditor-pay-method"
              value={payForm.watch("paymentMethod")}
              onChange={(v) => payForm.setValue("paymentMethod", v as SalePaymentMethod)}
              t={t}
            />
          </FormField>
          <FormField
            id="creditor-pay-reference"
            label={t("Reference")}
            error={payForm.formState.errors.reference?.message}
          >
            <Input
              id="creditor-pay-reference"
              placeholder={t("Reference note (optional)")}
              {...payForm.register("reference")}
            />
          </FormField>
        </form>
      </Modal>
    </section>
  );
}
