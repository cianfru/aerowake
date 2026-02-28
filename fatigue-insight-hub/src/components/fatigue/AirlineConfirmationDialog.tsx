/**
 * AirlineConfirmationDialog
 *
 * Shown after a pilot's first roster upload when the backend detects
 * a probable airline with confidence < 0.9.
 *
 * Flow:
 *   1. "We think you fly for **Qatar Airways**. Is that correct?"
 *   2. [Confirm] → POST /api/companies/confirm → done
 *   3. [Change] → text field for manual airline entry
 *
 * High-confidence detections (>= 0.9) are auto-confirmed silently
 * and a toast is shown instead (handled by the parent).
 */

import { useState } from 'react';
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

  const confidencePercent = Math.round(detection.confidence * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Airline Detection
          </DialogTitle>
          <DialogDescription>
            We detected your airline from your roster. Please confirm so we can
            group your data with your company peers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!isChanging ? (
            <>
              {/* Detected airline card */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Detected airline ({confidencePercent}% confidence)
                </p>
                <p className="text-lg font-semibold">{detection.suggestedName}</p>
                {detection.suggestedIcao && (
                  <p className="text-sm text-muted-foreground">
                    ICAO: {detection.suggestedIcao}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

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
                  placeholder="e.g. Qatar Airways"
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
