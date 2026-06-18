import type { ReactNode } from "react";

import { Separator } from "@/app/components/ui/separator";
import { cn } from "@/lib/utils";

type SaleFormSectionProps = {
  title: string;
  id: string;
  icon?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  /** When false, skips the top separator (use for the first section in a card). */
  divided?: boolean;
};

export function SaleFormSection({
  title,
  id,
  icon,
  description,
  children,
  className,
  divided = true,
}: SaleFormSectionProps) {
  return (
    <>
      {divided ? <Separator className="my-6" /> : null}
      <section className={cn("space-y-4", className)} aria-labelledby={id}>
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
