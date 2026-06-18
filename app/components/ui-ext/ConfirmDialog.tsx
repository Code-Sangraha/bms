import { Loader2 } from "lucide-react";

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
import { Button } from "@/app/components/ui/button";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { useI18n } from "@/app/providers/I18nProvider";

type ConfirmDialogVariant = "danger" | "default";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Drop-in replacement for the legacy ConfirmModal. Same props, same behavior.
 * Bottom Sheet on mobile, centered Dialog on desktop.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const isDanger = variant === "danger";

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={loading}
      >
        {t(cancelLabel)}
      </Button>
      <Button
        type="button"
        variant={isDanger ? "destructive" : "default"}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {t(confirmLabel)}
      </Button>
    </>
  );

  const handleOpenChange = (open: boolean) => {
    if (!open && !loading) onClose();
  };

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{message}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="pt-4">{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
