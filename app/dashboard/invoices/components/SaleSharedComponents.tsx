import type { ReactNode } from "react";

import { Separator } from "@/app/components/ui/separator";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * SaleSummary — replaces ad-hoc <dl> summary panels and table-footer totals.
 * --------------------------------------------------------------------------- */

export type SummaryRow = {
  label: string;
  value: ReactNode;
  className?: string;
};

type SaleSummaryProps = {
  rows: SummaryRow[];
  /** Optional discount input row (processed POS). */
  discountInput?: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  };
  totalLabel: string;
  totalValue: ReactNode;
  className?: string;
};

export function SaleSummary({
  rows,
  discountInput,
  totalLabel,
  totalValue,
  className,
}: SaleSummaryProps) {
  return (
    <dl className={cn("saleSummaryPanel", className)}>
      {rows.map((row, i) => (
        <div key={i} className={cn("saleSummaryRow", row.className)}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      {discountInput ? (
        <div className="saleSummaryRow">
          <dt>
            <label htmlFor={discountInput.id}>{discountInput.label}</label>
          </dt>
          <dd>
            <Input
              id={discountInput.id}
              className="h-8 max-w-[7.5rem]"
              type="number"
              min={0}
              step="any"
              value={discountInput.value}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => discountInput.onChange(e.target.value)}
            />
          </dd>
        </div>
      ) : null}
      <div className="saleSummaryTotal" aria-live="polite">
        <span>{totalLabel}</span>
        <strong>{totalValue}</strong>
      </div>
    </dl>
  );
}

/* ---------------------------------------------------------------------------
 * SaleCartList — compact list replacement for in-card <Table> line items.
 * --------------------------------------------------------------------------- */

export type CartLineItem = {
  id: string;
  /** Primary label (product name, livestock label). */
  primary: string;
  /** Optional secondary info rendered as a muted badge. */
  badge?: ReactNode;
  /** Right-of-primary detail, e.g. weight. */
  detail?: string;
  /** Amount / subtotal shown at the far right. */
  amount: string;
  /** Optional tag shown beside amount (e.g. "Custom"). */
  amountTag?: ReactNode;
  /** Whether this row is currently being edited. */
  editing?: boolean;
};

type SaleCartListProps = {
  items: CartLineItem[];
  emptyTitle: string;
  emptyHint?: string;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  editLabel?: string;
  deleteLabel?: string;
  className?: string;
};

export function SaleCartList({
  items,
  emptyTitle,
  emptyHint,
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
  className,
}: SaleCartListProps) {
  if (items.length === 0) {
    return (
      <div className={cn("saleCartList saleCartList--empty", className)}>
        <p className="saleCartEmptyTitle">{emptyTitle}</p>
        {emptyHint ? <p className="saleCartEmptyHint">{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <ul className={cn("saleCartList", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className={cn("saleCartRow", item.editing && "saleCartRow--editing")}
        >
          <div className="saleCartRowMain">
            <span className="saleCartRowPrimary">{item.primary}</span>
            {item.badge ? (
              <span className="saleCartRowBadge">{item.badge}</span>
            ) : null}
          </div>
          <div className="saleCartRowMeta">
            {item.detail ? (
              <span className="saleCartRowDetail">{item.detail}</span>
            ) : null}
            <span className="saleCartRowAmount">
              {item.amount}
              {item.amountTag ? (
                <span className="saleCartRowAmountTag">{item.amountTag}</span>
              ) : null}
            </span>
            {(onEdit || onDelete) ? (
              <span className="saleCartRowActions">
                {onEdit ? (
                  <button
                    type="button"
                    className="saleCartRowBtn"
                    onClick={() => onEdit(index)}
                    aria-label={editLabel}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className="saleCartRowBtn saleCartRowBtn--danger"
                    onClick={() => onDelete(index)}
                    aria-label={deleteLabel}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * SaleFormSection — adds a compact variant (no icon chip).
 * --------------------------------------------------------------------------- */

export type SaleFormSectionProps = {
  title: string;
  id: string;
  icon?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  /** When false, skips the top separator (use for the first section in a card). */
  divided?: boolean;
  /** Compact mode: no icon chip, just a muted heading. */
  compact?: boolean;
};

export function SaleFormSection({
  title,
  id,
  icon,
  description,
  children,
  className,
  divided = true,
  compact = false,
}: SaleFormSectionProps) {
  if (compact) {
    return (
      <>
        {divided ? <Separator className="my-3" /> : null}
        <section className={cn("flex flex-col gap-2", className)} aria-labelledby={id}>
          <h3
            id={id}
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {title}
          </h3>
          {children}
        </section>
      </>
    );
  }

  return (
    <>
      {divided ? <Separator className="my-4" /> : null}
      <section className={cn("flex flex-col gap-3", className)} aria-labelledby={id}>
        <div className="flex items-start gap-2.5">
          {icon ? (
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3
              id={id}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {title}
            </h3>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </section>
    </>
  );
}
