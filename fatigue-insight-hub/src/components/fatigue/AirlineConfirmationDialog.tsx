/** Company membership always requires the pilot’s explicit confirmation. */

import { useState } from 'react';
import { operatorLabel } from '@/lib/operator-label';
import { Plane, Check, Edit2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanyDetection } from '@/types/fatigue';

interface AirlineConfirmationDialogProps {
  detection: CompanyDetection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}

export function AirlineConfirmationDialog({
  detection,
  open,
  onOpenChange,
  onConfirmed,
}: AirlineConfirmationDialogProps) {
  const { confirmCompany } = useAuth();
  const [isChanging, setIsChanging] = useState(false);
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmCompany(detection.suggestedName, detection.suggestedIcao);
      onConfirmed();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm airline');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmCompany(customName.trim());
      onConfirmed();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set airline');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Confirm your operator
          </DialogTitle>
          <DialogDescription>
            Your roster suggests an operator. Confirm or change this suggestion to associate your account. Sharing anonymised metrics remains a separate choice in your privacy settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!isChanging ? (
            <>
              {/* Detected airline card */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Suggested operator · inferred from roster
                </p>
                <p className="text-lg font-semibold">{operatorLabel(detection.suggestedName, detection.suggestedIcao)}</p>
                {detection.suggestedIcao && (
                  <p className="text-sm text-muted-foreground">
                    ICAO: {detection.suggestedIcao}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Not now</Button>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsChanging(true)}
                  disabled={isSubmitting}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Manual airline entry */}
              <div className="space-y-2">
                <label htmlFor="airline-name" className="text-sm font-medium">
                  Enter your airline name
                </label>
                <Input
                  id="airline-name"
                  placeholder="e.g. your airline"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleCustomSubmit}
                  disabled={isSubmitting || !customName.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChanging(false);
                    setCustomName('');
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
