import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { offlineStore } from '@/lib/offline-store';
import { Button } from '@/components/ui/button';
import { withdraw } from '@/lib/debrief-api';
import { STUDY_RETENTION } from '@/lib/study-config';
import { ConfirmDialog } from './ConfirmDialog';
import { StudyEnrolmentDialog } from './StudyEnrolmentDialog';
import { formatInZone } from './time';
import { useEnrolment, useRefreshStudy } from './useStudy';

/** Study status with join / withdraw. Used on Account and in History › Debriefs. */
export function StudyParticipation({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const enrolment = useEnrolment();
  const refresh = useRefreshStudy();
  const [joinOpen, setJoinOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function leave() {
    setBusy(true); setMessage('');
    try {
      const result = await withdraw(deleteData);
      if (deleteData && user) {
        await offlineStore.clearInflight(user.id);
        window.dispatchEvent(new Event('aerowake-inflight-changed'));
      }
      setLeaveOpen(false);
      await refresh();
      setMessage(deleteData
        ? `You have left the study. Deleted ${result.deleted.debriefs} debriefs, ${result.deleted.observations} diary entries and ${result.deleted.inflight ?? 0} in-flight ratings.`
        : 'You have left the study. Your existing entries are kept until you delete them.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not withdraw.');
    } finally {
      setBusy(false);
    }
  }

  if (enrolment.isLoading) return <p className="text-sm text-muted-foreground" role="status">Loading study status…</p>;
  if (enrolment.isError) return <p className="text-sm text-destructive" role="alert">{enrolment.error.message}</p>;
  const data = enrolment.data;
  const since = formatInZone(data?.enrolled_at, 'UTC', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="space-y-3">
      {data?.enrolled ? (
        <p className="text-sm">
          <span className="font-medium">Contributing</span>
          <span className="text-muted-foreground"> · since {since} · {data.debriefs} debriefs, {data.observations} diary entries</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {data?.withdrawn_at ? 'You stopped contributing. Your ratings are not used to calibrate the model. You can turn it back on at any time.' : 'You are not contributing. Your in-flight ratings stay private. Read the information and choose whether to help evaluate the model.'}
        </p>
      )}
      {!compact && <p className="text-xs text-muted-foreground">Retention: {STUDY_RETENTION}.</p>}
      <div className="flex flex-wrap gap-2">
        {data?.enrolled
          ? <Button variant="outline" size="sm" onClick={() => { setDeleteData(false); setLeaveOpen(true); }}>Stop contributing</Button>
          : <><Button size="sm" onClick={() => setJoinOpen(true)}>{data?.withdrawn_at ? 'Contribute again' : 'Read study information'}</Button>
            <Button variant="outline" size="sm" onClick={() => { setDeleteData(true); setLeaveOpen(true); }}>Delete saved entries</Button></>}
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <StudyEnrolmentDialog open={joinOpen} onOpenChange={setJoinOpen} rejoining={!!data?.withdrawn_at} />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Stop contributing?"
        description="New study contributions will stop and existing in-flight ratings will be excluded from calibration. Private in-flight logging stays available. Existing entries are kept unless you tick the box below."
        confirmLabel={deleteData ? 'Stop and delete my entries' : 'Stop contributing'}
        destructive={deleteData}
        onConfirm={leave}
        busy={busy}
      >
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />
          Also delete all my debriefs, diary entries and in-flight ratings, including queued ratings on this device. Exports already shared cannot be recalled.
        </label>
      </ConfirmDialog>
    </div>
  );
}
