import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { TableSkeleton } from "@/app/components/ui-ext/LoadingState";
import { EmptyState } from "@/app/components/ui-ext/EmptyState";
import { ErrorState } from "@/app/components/ui-ext/ErrorState";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Optional footer (e.g. pagination) rendered under the table. */
  footer?: React.ReactNode;
};

/**
 * Standard data table: skeleton on load, error state with retry, empty state
 * fallback, and a thin wrapper around shadcn Table. Pages should prefer this
 * over hand-rolling tables so every list page behaves identically.
 */
export function DataTable<T>({
  columns,
  rows,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  getRowKey,
  onRowClick,
  className,
  footer,
}: DataTableProps<T>) {
  if (isLoading) {
    return <TableSkeleton columns={columns.length} />;
  }

  if (isError) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.headerClassName,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const key = getRowKey ? getRowKey(row, index) : String(index);
            return (
              <TableRow
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className,
                    )}
                  >
                    {col.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {footer ? <div className="border-t bg-muted/30 p-3">{footer}</div> : null}
    </div>
  );
}
