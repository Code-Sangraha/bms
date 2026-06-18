import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Uniform error state for failed data fetches. Optional retry callback
 * renders a primary button so users can attempt the request again without
 * a page reload.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this section. Please try again.",
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1"
        >
          <RotateCcw className="h-4 w-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
