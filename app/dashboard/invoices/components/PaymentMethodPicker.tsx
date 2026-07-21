import {
  SALE_PAYMENT_METHOD_OPTIONS,
  PAY_LATER_UI_VALUE,
  type SalePaymentSelection,
} from "@/lib/salePaymentMethods";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";

type PaymentMethodPickerProps = {
  value: SalePaymentSelection;
  onChange: (value: SalePaymentSelection) => void;
  t: (key: string) => string;
  labelId?: string;
  className?: string;
  columns?: 2 | 3;
  /** When true, render a 4th "Pay Later" segment (UI-only sentinel). */
  allowPayLater?: boolean;
};

export function PaymentMethodPicker({
  value,
  onChange,
  t,
  labelId,
  className,
  columns = 3,
  allowPayLater = false,
}: PaymentMethodPickerProps) {
  const payLaterLabel = t("Pay Later");
  const gridCols = allowPayLater ? "grid-cols-4" : columns === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue as SalePaymentSelection);
      }}
      className={cn(
        "grid w-full gap-1 rounded-lg border border-border bg-muted p-1",
        gridCols,
        className,
      )}
      aria-labelledby={labelId}
    >
      {SALE_PAYMENT_METHOD_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className="min-h-9 w-full border border-transparent px-2 text-xs font-semibold data-[state=on]:border-primary/25 data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm sm:min-h-10 sm:text-sm"
        >
          {t(opt.label)}
        </ToggleGroupItem>
      ))}
      {allowPayLater ? (
        <ToggleGroupItem
          value={PAY_LATER_UI_VALUE}
          className="min-h-9 w-full border border-transparent px-2 text-xs font-semibold data-[state=on]:border-primary/25 data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm sm:min-h-10 sm:text-sm"
        >
          {payLaterLabel}
        </ToggleGroupItem>
      ) : null}
    </ToggleGroup>
  );
}
