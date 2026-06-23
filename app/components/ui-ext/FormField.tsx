import * as React from "react";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/app/components/ui/field";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Set to true to span the full width of a 2-column form grid. */
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Lightweight wrapper that gives every form field the same vertical structure:
 *   <label> <control> <error?>
 *
 * Works with both react-hook-form (pass `error={fieldState.error?.message}`)
 * and uncontrolled forms. The id prop is forwarded to the label's `htmlFor`
 * for accessibility.
 */
export function FormField({
  id,
  label,
  description,
  error,
  required,
  fullWidth,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description && id ? `${id}-description` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <Field
      data-invalid={error ? true : undefined}
      className={cn(
        "flex flex-col gap-1.5",
        fullWidth && "md:col-span-2",
        className,
      )}
    >
      {label ? (
        <FieldLabel htmlFor={id} className="flex items-center gap-1">
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </FieldLabel>
      ) : null}
      {children}
      {description && !error ? (
        <FieldDescription id={descriptionId}>
          {description}
        </FieldDescription>
      ) : null}
      {error ? (
        <FieldDescription id={errorId} role="alert" className="font-medium">
          {error}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

/**
 * Two-column responsive form grid. Fields use `fullWidth` to span both
 * columns when needed (e.g. a textarea).
 */
export function FormGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}
      {...props}
    />
  );
}

/**
 * Standard footer row for forms and modals. Right-aligned Cancel | Submit
 * by default; pass `align="between"` for a split toolbar.
 */
export function FormFooter({
  className,
  align = "end",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "end" | "between" }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pt-2",
        align === "end" ? "justify-end" : "justify-between",
        className,
      )}
      {...props}
    />
  );
}
