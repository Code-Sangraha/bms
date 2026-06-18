import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentPickerProps<T extends string> = {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  labelId?: string;
  className?: string;
};

export function SegmentPicker<T extends string>({
  value,
  options,
  onChange,
  labelId,
  className,
}: SegmentPickerProps<T>) {
  return (
    <div
      className={cn(
        "grid gap-0 rounded-lg border border-border bg-muted p-1",
        options.length === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
      role="radiogroup"
      aria-labelledby={labelId}
    >
      {options.map((opt) => {
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
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
