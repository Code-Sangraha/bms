"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { MdBusiness, MdInfoOutline } from "react-icons/md";
import Modal from "@/app/components/Modal/Modal";
import { useI18n } from "@/app/providers/I18nProvider";
import { useToast } from "@/app/providers/ToastProvider";
import {
  completeLivestockPartialPayment,
  type PaymentStatus,
} from "@/handlers/product";
import "./livestockDetailShell.scss";

export type PartialPaymentExpense = {
  id: string;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: PaymentStatus;
};

const partialPaymentSchema = z.object({
  paidAmount: z.coerce
    .number({ errorMap: () => ({ message: "Payment amount is required" }) })
    .refine((n) => Number.isFinite(n) && n > 0, "Payment amount must be greater than 0"),
});

type PartialPaymentFormValues = z.infer<typeof partialPaymentSchema>;

const PAYMENT_STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  ADVANCE: "livestockDetailModalBadge livestockDetailModalBadgeAdvance",
  PARTIAL: "livestockDetailModalBadge livestockDetailModalBadgePartial",
  FULL: "livestockDetailModalBadge livestockDetailModalBadgeFull",
};

type LivestockCompletePartialPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: PartialPaymentExpense | null;
  onSuccess?: () => void;
};

function formatAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function LivestockCompletePartialPaymentModal({
  isOpen,
  onClose,
  expense,
  onSuccess,
}: LivestockCompletePartialPaymentModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PartialPaymentFormValues>({
    resolver: zodResolver(partialPaymentSchema),
    defaultValues: { paidAmount: undefined },
  });

  const mutation = useMutation({
    mutationFn: (values: PartialPaymentFormValues) =>
      completeLivestockPartialPayment({
        expenseId: expense!.id,
        paidAmount: values.paidAmount,
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.status === 401) navigate("/login");
        showToast(result.error ?? t("Failed to record payment."), "error");
        return;
      }
      showToast(t("Payment recorded successfully."), "success");
      reset();
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["livestockExpenseHistory"] });
      void queryClient.invalidateQueries({ queryKey: ["outletExpenses"] });
      onSuccess?.();
    },
    onError: () => {
      showToast(t("Something went wrong. Please try again."), "error");
    },
  });

  const onSubmit = (data: PartialPaymentFormValues) => {
    if (!expense) return;
    if (data.paidAmount > expense.dueAmount) {
      setError("paidAmount", {
        type: "manual",
        message: t("Payment amount cannot exceed due amount."),
      });
      return;
    }
    mutation.mutate(data);
  };

  const isPending = mutation.isPending;

  return (
    <Modal
      isOpen={isOpen && Boolean(expense)}
      onClose={onClose}
      title={t("Record partial payment")}
      subtitle={t("Add a payment toward the outstanding balance.")}
      modalClassName="modalWide modalCompact partialPaymentModal"
    >
      {expense && (
        <form onSubmit={handleSubmit(onSubmit)} className="partialPaymentModalForm">
          <div className="partialPaymentModalSupplier">
            <MdBusiness aria-hidden />
            <span>
              {t("Supplier")}: <strong>{expense.supplierName}</strong>
            </span>
          </div>

          <div className="livestockDetailModalSummary partialPaymentModalSummary">
            <div className="livestockDetailModalSummaryCard">
              <span className="livestockDetailModalSummaryLabel">{t("Total")}</span>
              <span className="livestockDetailModalSummaryValue">
                {formatAmount(expense.totalAmount)}
              </span>
            </div>
            <div className="livestockDetailModalSummaryCard">
              <span className="livestockDetailModalSummaryLabel">{t("Paid")}</span>
              <span className="livestockDetailModalSummaryValue">
                {formatAmount(expense.paidAmount)}
              </span>
            </div>
            <div className="livestockDetailModalSummaryCard livestockDetailModalSummaryCardHighlight">
              <span className="livestockDetailModalSummaryLabel">{t("Due")}</span>
              <span className="livestockDetailModalSummaryValue livestockDetailModalSummaryValueDue">
                {formatAmount(expense.dueAmount)}
              </span>
            </div>
            <div className="livestockDetailModalSummaryCard">
              <span className="livestockDetailModalSummaryLabel">{t("Payment status")}</span>
              <span className={PAYMENT_STATUS_BADGE_CLASS[expense.paymentStatus]}>
                {expense.paymentStatus === "PARTIAL" ? t("Partial") : expense.paymentStatus}
              </span>
            </div>
          </div>

          <div className="livestockDetailModalField">
            <label className="livestockDetailModalLabel" htmlFor="partial-payment-amount">
              {t("Payment amount")}
            </label>
            <input
              id="partial-payment-amount"
              type="number"
              min={0}
              step="any"
              max={expense.dueAmount}
              className="livestockDetailModalInput"
              placeholder={t("Enter amount up to due balance")}
              disabled={isPending}
              {...register("paidAmount", { valueAsNumber: true })}
            />
            <p className="livestockDetailModalHint livestockDetailModalHintWithIcon" role="note">
              <MdInfoOutline aria-hidden className="livestockDetailModalHintIcon" />
              {t("Maximum")}: {formatAmount(expense.dueAmount)}
            </p>
            {errors.paidAmount?.message && (
              <p className="livestockDetailModalError" role="alert">
                {errors.paidAmount.message}
              </p>
            )}
          </div>

          <div className="livestockDetailModalFooter">
            <button
              type="button"
              className="livestockDetailModalBtn"
              disabled={isPending}
              onClick={onClose}
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              className="livestockDetailModalBtn livestockDetailModalBtnPrimary"
              disabled={isPending}
            >
              {isPending ? t("Saving…") : t("Record payment")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
