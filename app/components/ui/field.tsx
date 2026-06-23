import * as React from "react";

import { Label } from "@/app/components/ui/label";
import { cn } from "@/lib/utils";

const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset ref={ref} className={cn("flex flex-col gap-4", className)} {...props} />
));
FieldSet.displayName = "FieldSet";

const FieldLegend = React.forwardRef<
  HTMLLegendElement,
  React.HTMLAttributes<HTMLLegendElement> & { variant?: "legend" | "label" }
>(({ className, variant = "legend", ...props }, ref) => (
  <legend
    ref={ref}
    className={cn(
      variant === "label"
        ? "text-sm font-medium leading-none text-foreground"
        : "text-base font-semibold leading-none tracking-tight text-foreground",
      className,
    )}
    {...props}
  />
));
FieldLegend.displayName = "FieldLegend";

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-4", className)} {...props} />
));
FieldGroup.displayName = "FieldGroup";

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }
>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      orientation === "horizontal"
        ? "grid gap-2 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] sm:items-center"
        : "flex flex-col gap-1.5",
      "group/field data-[disabled]:opacity-70 data-[invalid]:text-destructive",
      className,
    )}
    {...props}
  />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => (
  <Label
    ref={ref}
    className={cn(
      "group-data-[disabled]/field:cursor-not-allowed group-data-[disabled]/field:opacity-70 group-data-[invalid]/field:text-destructive",
      className,
    )}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

const FieldTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-medium leading-none text-foreground", className)}
    {...props}
  />
));
FieldTitle.displayName = "FieldTitle";

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-xs leading-relaxed text-muted-foreground group-data-[invalid]/field:text-destructive",
      className,
    )}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

export {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
};
