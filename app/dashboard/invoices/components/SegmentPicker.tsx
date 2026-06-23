import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";

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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue as T);
      }}
      className={cn(
        "grid w-full gap-1 rounded-lg border border-border bg-muted p-1",
        options.length === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
      aria-labelledby={labelId}
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className="min-h-9 w-full border border-transparent px-2 text-xs font-semibold data-[state=on]:border-primary/25 data-[state=on]:bg-background data-[state=on]:text-primary data-[state=on]:shadow-sm sm:min-h-10 sm:text-sm"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
