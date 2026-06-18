import * as React from "react";

import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-card",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="grid gap-3 border-b bg-muted/40 p-3" style={gridStyle(columns)}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-24" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid items-center gap-3 p-3"
            style={gridStyle(columns)}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0 ? "w-3/4" : c === columns - 1 ? "w-1/3" : "w-1/2",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function gridStyle(columns: number): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

type CardGridSkeletonProps = {
  count?: number;
  className?: string;
};

export function CardGridSkeleton({
  count = 6,
  className,
}: CardGridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
          <Skeleton className="mb-3 h-4 w-1/2" />
          <Skeleton className="mb-2 h-3 w-3/4" />
          <Skeleton className="mb-4 h-3 w-2/3" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

type FormSkeletonProps = {
  fields?: number;
  columns?: 1 | 2;
  className?: string;
};

export function FormSkeleton({
  fields = 6,
  columns = 2,
  className,
}: FormSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 ? "md:grid-cols-2" : "grid-cols-1",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

type DetailSkeletonProps = {
  className?: string;
};

export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
