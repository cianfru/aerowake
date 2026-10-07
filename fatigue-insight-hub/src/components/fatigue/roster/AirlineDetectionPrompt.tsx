import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AirlineConfirmationDialog } from '../AirlineConfirmationDialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanyDetection } from '@/types/fatigue';

/**
 * After the first upload the backend may suggest the pilot's airline.
 * Company membership always requires explicit confirmation, including cached detections.
 * Handles each analysis once.
 */
export function AirlineDetectionPrompt() {
  const { state } = useAnalysis();
  const { isAuthenticated, user } = useAuth();
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

    setPending(detection);
    setOpen(true);
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
