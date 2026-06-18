import * as React from "react";

import { cn } from "@/lib/utils";

type PageShellProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Outer page container. Caps width, centers content, and applies the
 * canonical vertical rhythm. Use once at the top of every page.
 */
export function PageShell({ className, ...props }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 pb-10",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Standard page content wrapper. Use directly under PageHeader to apply the
 * standard `space-y-6` rhythm between sections / cards / tables.
 */
export function PageContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-6", className)} {...props} />;
}

/**
 * Section grouping inside a page. Adds a header row (title + actions) and
 * standardises spacing between sections.
 */
export function PageSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}
