"use client";

import { MdPayments } from "react-icons/md";
import { useI18n } from "@/app/providers/I18nProvider";
import "./expensePayment.scss";

type ExpenseRecordPaymentButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

export default function ExpenseRecordPaymentButton({
  onClick,
  disabled,
  compact,
  className,
}: ExpenseRecordPaymentButtonProps) {
  const { t } = useI18n();
  const classes = [
    "expenseRecordPaymentBtn",
    compact ? "expenseRecordPaymentBtnCompact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      <MdPayments aria-hidden />
      {t("Record payment")}
    </button>
  );
}
