import {
  SALE_PAYMENT_METHOD_OPTIONS,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { cn } from "@/lib/utils";

type PaymentMethodPickerProps = {
  value: SalePaymentMethod;
  onChange: (value: SalePaymentMethod) => void;
  t: (key: string) => string;
  labelId?: string;
  className?: string;
  columns?: 2 | 3;
};

export function PaymentMethodPicker({
  value,
  onChange,
  t,
  labelId,
  className,
  columns = 3,
}: PaymentMethodPickerProps) {
  return (
    <div
      className={cn(
        "grid gap-0 rounded-lg border border-border bg-muted p-1",
        columns === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
      role="radiogroup"
      aria-labelledby={labelId}
    >
      {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "min-h-9 rounded-md px-2 text-xs font-semibold transition-colors sm:min-h-10 sm:text-sm",
              selected
                ? "border border-primary/25 bg-background text-primary shadow-sm"
                : "border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
            onClick={() => onChange(opt.value)}
          >
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
