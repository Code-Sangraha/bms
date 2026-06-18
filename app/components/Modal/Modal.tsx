"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/lib/utils";

type ModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra class on the inner dialog (e.g. wider forms). */
  modalClassName?: string;
};

/**
 * Backwards-compatible Modal. Same prop surface as the legacy SCSS-based
 * modal so every existing caller (~12 product/invoice modals + ConfirmModal)
 * keeps working, but the rendering layer is now shadcn Dialog so it picks up
 * the theme, focus ring, animations, and a11y for free.
 */
export default function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
  modalClassName,
}: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "sm:max-w-2xl",
          modalClassName,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
