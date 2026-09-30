import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FELT_LABELS, MOMENT_LABELS, OPERATION_LABELS, deleteAllDebriefs, deleteDebrief, downloadJson, exportDebriefs, personalSummary,
  type Debrief,
} from '@/lib/debrief-api';
import { RISK_LEVEL_LABELS, normalizeRiskLevel } from '@/lib/risk-scale';
import { ConfirmDialog } from './ConfirmDialog';
import { StudyParticipation } from './StudyParticipation';
import { dutyDateLabel } from './time';
import { useDebriefs, useRefreshStudy } from './useStudy';

const STREAM_LABELS: Record<Debrief['quality']['stream'], string> = {
  momentary: 'rated within an hour',
  same_day: 'rated the same day',
  recalled: 'rated within two days',
  late: 'rated later',
};

/** History › Debriefs: the pilot's own debriefs with per-record delete, export and withdraw. */
export function DebriefHistory() {
  const debriefs = useDebriefs();
  const refresh = useRefreshStudy();
  const [target, setTarget] = useState<Debrief | 'all' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const rows = debriefs.data ?? [];
  const summary = personalSummary(rows);

  async function remove() {
    if (!target) return;
    setBusy(true); setMessage('');
    try {
      if (target === 'all') {
        const result = await deleteAllDebriefs();
        setMessage(`Deleted ${result.deleted} debriefs.`);
      } else {
        await deleteDebrief(target.id);
        setMessage('Debrief deleted.');
      }
      setTarget(null);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true); setMessage('');
    try {
      downloadJson(await exportDebriefs(), 'aerowake-debriefs.json');
      setMessage('Export downloaded. It is pseudonymised, not anonymous: share it only if you choose to.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not export.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="space-y-3 p-4 md:p-5">
          <h2 className="text-lg font-semibold">Pilot study</h2>
          <StudyParticipation compact />
        </Card>

        {summary && (
          <Card className="p-4 md:p-5">
            <p className="text-sm">
              Across {summary.n} duties, your sleepiest-point rating was on average{' '}
              <span className="font-mono tabular font-medium">{Math.abs(summary.meanDifference).toFixed(1)} KSS</span>{' '}
              {summary.meanDifference >= 0 ? 'higher' : 'lower'} than the forecast peak.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">A description of your own entries, not a calibration. The model bands do not change.</p>
          </Card>
        )}

        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-5">
            <h2 className="text-base font-semibold">Your debriefs</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={download} disabled={busy || rows.length === 0}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />Export
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTarget('all')} disabled={busy || rows.length === 0}>Delete all</Button>
            </div>
          </div>
          {debriefs.isLoading && <p role="status" className="px-5 py-6 text-sm text-muted-foreground">Loading debriefs…</p>}
          {debriefs.isError && <p role="alert" className="px-5 py-6 text-sm text-destructive">{debriefs.error.message}</p>}
          {!debriefs.isLoading && !debriefs.isError && rows.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No debriefs yet. After a duty, open your roster and choose Debrief on that duty.
            </p>
          )}
          <ul className="divide-y divide-border">
            {rows.map((d) => <DebriefRow key={d.id} debrief={d} onDelete={() => setTarget(d)} />)}
          </ul>
        </Card>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={target === 'all' ? 'Delete all debriefs?' : 'Delete this debrief?'}
        description={target === 'all'
          ? 'This removes every debrief from your account. Exports you have already shared cannot be recalled.'
          : 'This removes the rating and its forecast snapshot from your account.'}
        confirmLabel={target === 'all' ? 'Delete all' : 'Delete'}
        onConfirm={remove}
        busy={busy}
      />
    </div>
  );
}

function DebriefRow({ debrief: d, onDelete }: { debrief: Debrief; onDelete: () => void }) {
  const tz = d.forecast?.home_timezone || 'UTC';
  const forecast = d.moment === 'worst_moment' ? d.forecast?.max_kss : d.forecast?.kss_at_event;
  const level = normalizeRiskLevel(d.forecast?.risk_level);
  const route = d.duty?.route?.join('–');
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 md:px-5">
      <div className="min-w-0 space-y-1 text-sm">
        <p>
          <span className="font-medium">{dutyDateLabel(d.duty_report_utc, tz)}</span>
          {route && <span className="ml-2 font-mono text-xs text-muted-foreground">{route}</span>}
        </p>
        {d.operation === 'not_operated' ? (
          <p className="text-muted-foreground">{OPERATION_LABELS.not_operated}</p>
        ) : (
          <p>
            {MOMENT_LABELS[d.moment]}:{' '}
            <span className="font-mono tabular">{d.kss !== null ? `you KSS ${d.kss}` : `you SP ${d.samn_perelli}`}</span>
            {forecast != null && (
              <span className="text-muted-foreground"> · forecast <span className="font-mono tabular">{forecast.toFixed(1)}</span>
                {d.moment === 'worst_moment' && level !== 'unknown' ? ` ${RISK_LEVEL_LABELS[level]}` : ''}</span>
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {STREAM_LABELS[d.quality?.stream] ?? ''}
          {d.felt_vs_prediction ? ` · ${FELT_LABELS[d.felt_vs_prediction]}` : ''}
          {d.operation === 'times_changed' ? ' · times changed' : ''}
        </p>
      </div>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Delete debrief for ${dutyDateLabel(d.duty_report_utc, tz)}, ${MOMENT_LABELS[d.moment]}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
