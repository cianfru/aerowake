import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AirlineConfirmationDialog } from '../AirlineConfirmationDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanyDetection } from '@/types/fatigue';

/**
 * After the first upload the backend may suggest the pilot's airline.
 * High confidence → confirmed silently with a toast; otherwise ask.
 * Handles each analysis once.
 */
export function AirlineDetectionPrompt() {
  const { state } = useAnalysis();
  const { isAuthenticated, user, confirmCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<CompanyDetection | null>(null);
  const handled = useRef<string | null>(null);

  const detection = state.analysisResults?.companyDetection;
  const analysisKey = state.analysisResults?.analysisId ?? null;

  useEffect(() => {
    if (!detection || !isAuthenticated || user?.company_id) return;
    const key = analysisKey ?? detection.suggestedName;
    if (handled.current === key) return;
    handled.current = key;

    if (!detection.needsConfirmation) {
      confirmCompany(detection.suggestedName, detection.suggestedIcao)
        .then(() => toast.success(`Added to ${detection.suggestedName}`))
        .catch(() => {
          setPending(detection);
          setOpen(true);
        });
    } else {
      setPending(detection);
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection, isAuthenticated, user?.company_id, analysisKey]);

  if (!pending) return null;
  return (
    <AirlineConfirmationDialog
      detection={pending}
      open={open}
      onOpenChange={setOpen}
      onConfirmed={() => {
        setPending(null);
        toast.success('Airline confirmed!');
      }}
    />
  );
}
