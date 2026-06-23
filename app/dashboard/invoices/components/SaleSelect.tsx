import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

const EMPTY_SELECT_VALUE = "__sale_empty_value__";

export type SaleSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SaleSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SaleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export function SaleSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  onOpenChange,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: SaleSelectProps) {
  const hasPlaceholder = Boolean(placeholder);
  const selectedValue = value || (hasPlaceholder ? EMPTY_SELECT_VALUE : undefined);
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const selectedTitle = typeof selectedLabel === "string" ? selectedLabel : undefined;

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => {
        onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue);
      }}
      disabled={disabled}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={cn("min-w-0", triggerClassName)}
        title={selectedTitle}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={className}>
        <SelectGroup>
          {placeholder ? (
            <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="min-w-0 [&>span:last-child]:truncate"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
