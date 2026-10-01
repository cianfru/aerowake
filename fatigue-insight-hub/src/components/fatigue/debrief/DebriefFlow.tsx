import { useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import { AuthSheet } from '@/components/auth/AuthSheet';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { debriefsFor } from '@/lib/debrief-api';
import type { DutyAnalysis } from '@/types/fatigue';
import { DebriefSheet } from './DebriefSheet';
import { StudyEnrolmentDialog } from './StudyEnrolmentDialog';
import { useDebriefs, useEnrolment } from './useStudy';

/**
 * Opens the right step for a debrief: sign-in prompt for guests, the one-time
 * study enrolment, then the blinded debrief sheet. Mount only while open.
 */
export function DebriefFlow({ duty, analysisId, onClose }: { duty: DutyAnalysis; analysisId?: string | null; onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const { state } = useAnalysis();
  const enrolment = useEnrolment();
  const debriefs = useDebriefs();
  const joined = useRef(false);
  const results = state.analysisResults;
  const tz = results?.homeBaseTimezone || 'UTC';
  const zoneLabel = results?.pilotBase || 'home';
  const id = analysisId ?? results?.analysisId;

  if (!isAuthenticated) return <SignInPrompt onClose={onClose} />;
  if (enrolment.isError) return <ProblemDialog message={enrolment.error.message} onClose={onClose} />;
  if (!enrolment.data || debriefs.isLoading) return null;
  if (!enrolment.data.enrolled) {
    return (
      <StudyEnrolmentDialog
        open
        onEnrolled={() => { joined.current = true; }}
        onOpenChange={(open) => { if (!open && !joined.current) onClose(); }}
      />
    );
  }
  if (!id || !duty.dutyId || !duty.reportTimeUtc) {
    return <ProblemDialog message="This roster is not saved to your account yet. Upload it again while signed in, then debrief." onClose={onClose} />;
  }
  return (
    <DebriefSheet
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      duty={duty}
      analysisId={id}
      homeTimezone={tz}
      zoneLabel={zoneLabel}
      existing={debriefsFor(duty, debriefs.data ?? [])}
    />
  );
}

function ProblemDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Debrief unavailable</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Guests: debriefs are private account records. Signing in starts a fresh
 * workspace (the analysis context is keyed by account), so we say so plainly.
 */
function SignInPrompt({ onClose }: { onClose: () => void }) {
  const [authOpen, setAuthOpen] = useState(false);
  if (authOpen) return <AuthSheet open onOpenChange={(open) => { if (!open) onClose(); }} />;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Sign in to debrief this duty</DialogTitle>
          <DialogDescription>
            Debriefs are saved privately to your account, so you can export or delete them and withdraw at any time.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Signing in opens a fresh workspace. Upload this roster again once you are signed in so it is saved to your account, then debrief from the duty.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button onClick={() => setAuthOpen(true)}><LogIn className="mr-2 h-4 w-4" aria-hidden="true" />Sign in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
