"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { cn } from "@/lib/utils";

type ResponsiveOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When true, ignore onClose while open state changes to closed (e.g. during submit). */
  preventClose?: boolean;
};

/**
 * Renders shadcn Dialog on desktop and a bottom Sheet on mobile (<768px).
 * One helper so Modal, ConfirmDialog, and future overlays stay consistent.
 */
export default function ResponsiveOverlay({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  preventClose = false,
}: ResponsiveOverlayProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = (open: boolean) => {
    if (!open && !preventClose) onClose();
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[90vh] overflow-y-auto rounded-t-2xl",
            className,
          )}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {subtitle ? (
              <SheetDescription>{subtitle}</SheetDescription>
            ) : null}
          </SheetHeader>
          {children ? (
            <div className="flex flex-col gap-4 py-2">{children}</div>
          ) : null}
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {footer}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        {children ? (
          <div className="flex flex-col gap-4">{children}</div>
        ) : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
