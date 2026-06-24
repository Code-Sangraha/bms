"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { useIsMobile } from "@/app/hooks/useIsMobile";

type ProcessedActionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
};

export default function ProcessedActionDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  loading = false,
}: ProcessedActionDialogProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = (open: boolean) => {
    if (!open && !loading) onClose();
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {subtitle ? <SheetDescription>{subtitle}</SheetDescription> : null}
          </SheetHeader>
          {children ? <div className="flex flex-col gap-4 py-2">{children}</div> : null}
          {footer ? (
            <SheetFooter className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {footer}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="flex flex-col gap-4">{children}</div> : null}
        {footer ? (
          <DialogFooter className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
