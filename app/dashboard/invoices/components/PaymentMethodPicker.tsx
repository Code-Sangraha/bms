import {
  SALE_PAYMENT_METHOD_OPTIONS,
  type SalePaymentMethod,
} from "@/lib/salePaymentMethods";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";

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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue as SalePaymentMethod);
      }}
      className={cn(
        "grid w-full gap-1 rounded-lg border border-border bg-muted p-1",
        columns === 2 ? "grid-cols-2" : "grid-cols-3",
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
    </ToggleGroup>
  );
}
