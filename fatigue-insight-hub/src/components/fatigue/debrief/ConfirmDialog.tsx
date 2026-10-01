import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Accessible confirmation for destructive study actions (replaces window.confirm). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy, children, destructive = true }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: ReactNode;
  confirmLabel: string; onConfirm: () => void; busy?: boolean; children?: ReactNode;
  /** Red confirm button; only for actions that delete data. */
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent role="alertdialog" className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
