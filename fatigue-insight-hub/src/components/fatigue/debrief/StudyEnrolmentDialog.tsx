import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { enrol } from '@/lib/debrief-api';
import { STUDY_CONSENT_VERSION } from '@/lib/study-config';
import { StudyInformation } from './StudyInformation';
import { useRefreshStudy } from './useStudy';

/** One-time, versioned study enrolment. Calls onEnrolled (before closing) once the server confirms. */
export function StudyEnrolmentDialog({ open, onOpenChange, onEnrolled }: {
  open: boolean; onOpenChange: (open: boolean) => void; onEnrolled?: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useRefreshStudy();

  async function join() {
    setBusy(true); setError('');
    try {
      await enrol();
      await refresh();
      onEnrolled?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the study.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) { onOpenChange(next); if (!next) { setAgreed(false); setError(''); } } }}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <DialogTitle>Join the Aerowake pilot study</DialogTitle>
          <DialogDescription>Please read this before joining. It takes about two minutes.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <StudyInformation />
        </div>
        <div className="space-y-3 border-t border-border px-5 py-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I have read this information. I agree to Aerowake storing my study entries, including health-related sleep and sleepiness information, for the purpose described above.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            <p className="self-center text-xs text-muted-foreground">Consent version {STUDY_CONSENT_VERSION}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Not now</Button>
              <Button onClick={join} disabled={!agreed || busy}>{busy ? 'Joining…' : 'Join the study'}</Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
