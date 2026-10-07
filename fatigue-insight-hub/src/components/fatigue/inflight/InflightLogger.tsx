import { useMemo, useState } from 'react';
import { CloudOff, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInflightLog } from '@/hooks/useInflightLog';
import { useOnline } from '@/hooks/useOnline';
import { KSS_LABELS } from '@/lib/risk-scale';
import { formatHomeTime } from '@/lib/home-time';
import { cn } from '@/lib/utils';
import type { InflightPhase } from '@/lib/offline-store';
import type { DutyAnalysis } from '@/types/fatigue';

const PHASES: Array<[InflightPhase, string]> = [
  ['pre_flight', 'Pre-flight'], ['takeoff_climb', 'Climb'], ['cruise', 'Cruise'],
  ['descent_approach', 'Descent'], ['post_flight', 'After landing'],
];
const AGO: Array<[number, string]> = [[0, 'Now'], [15, '15 min ago'], [30, '30 min ago'], [60, '1 h ago']];

const isIso = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));

/** The duty's window for logging: from 3 h before report to 24 h after (as the server). */
export function canLogNow(duty: DutyAnalysis, now = Date.now()): boolean {
  if (!isIso(duty.reportTimeUtc)) return false;
  const report = Date.parse(duty.reportTimeUtc!);
  return now >= report - 3 * 3600000 && now <= report + 24 * 3600000;
}

/** A sensible phase for "now" from the sector times. */
function guessPhase(duty: DutyAnalysis, at: number): InflightPhase {
  const deps = duty.flightSegments.map((s) => s.departureIso).filter(isIso).map((s) => Date.parse(s!));
  const arrs = duty.flightSegments.map((s) => s.arrivalIso).filter(isIso).map((s) => Date.parse(s!));
  if (!deps.length || !arrs.length) return 'cruise';
  if (at < Math.min(...deps)) return 'pre_flight';
  if (at > Math.max(...arrs)) return 'post_flight';
  const sector = duty.flightSegments.find((s) => isIso(s.departureIso) && isIso(s.arrivalIso)
    && at >= Date.parse(s.departureIso!) && at <= Date.parse(s.arrivalIso!));
  if (!sector) return 'cruise';
  if (at < Date.parse(sector.departureIso!) + 30 * 60000) return 'takeoff_climb';
  if (at > Date.parse(sector.arrivalIso!) - 40 * 60000) return 'descent_approach';
  return 'cruise';
}

/**
 * Log how sleepy you feel during a duty (Karolinska Sleepiness Scale), offline
 * if need be. Each rating is kept on this device and sent to your account when
 * you are back online.
 */
export function InflightLogger({ duty, analysisId, homeTz, title = 'How sleepy do you feel?' }: {
  duty: DutyAnalysis; analysisId?: string | null; homeTz?: string; title?: string;
}) {
  const { entries, add, remove, syncing, syncError, loadError, isAuthenticated } = useInflightLog();
  const online = useOnline();
  const [kss, setKss] = useState<number | null>(null);
  const [phase, setPhase] = useState<InflightPhase>(() => guessPhase(duty, Date.now()));
  const [ago, setAgo] = useState(0);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const mine = useMemo(() => entries.filter((e) => e.dutyId === duty.dutyId
    && (!e.dutyReportUtc || !duty.reportTimeUtc || Date.parse(e.dutyReportUtc) === Date.parse(duty.reportTimeUtc))), [entries, duty]);
  const open = canLogNow(duty);
  if (!open && !mine.length) return null;

  const save = async () => {
    if (kss == null) return;
    await add({
      kss, phase, note: note.trim() || null,
      recordedAtUtc: new Date(Date.now() - ago * 60000).toISOString(),
      analysisId: analysisId ?? null, dutyId: duty.dutyId ?? null,
      dutyReportUtc: isIso(duty.reportTimeUtc) ? duty.reportTimeUtc! : null,
    });
    setSaved(!isAuthenticated ? 'Saved on this device as a guest. Sign in before logging future ratings to save those with your account.'
      : online ? 'Saved. Sending to your account…' : 'Saved on this device. It goes to your account when you are back online.');
    setKss(null);
    setNote('');
    setAgo(0);
  };

  return (
    <section aria-labelledby={`inflight-${duty.dutyId}`} className="space-y-3 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`inflight-${duty.dutyId}`} className="text-[15px] font-semibold">{title}</h3>
        {!online && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CloudOff className="h-3.5 w-3.5" aria-hidden="true" />Offline</span>}
      </div>
      {open && (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Sleepiness (KSS 1–9)" className="grid grid-cols-9 gap-1">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={kss === n} aria-label={`${n}, ${KSS_LABELS[n]}`}
                onClick={() => setKss(n)}
                className={cn('min-h-[44px] rounded-md border font-mono text-sm tabular transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  kss === n ? 'border-primary bg-primary/15 text-primary' : 'border-border text-foreground hover:bg-secondary')}>
                {n}
              </button>
            ))}
          </div>
          <p className="min-h-[1.25rem] text-xs text-muted-foreground">
            {kss != null ? `${kss} · ${KSS_LABELS[kss]}` : '1 extremely alert … 9 very sleepy, fighting sleep (Karolinska Sleepiness Scale).'}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Phase</span>
              <select value={phase} onChange={(e) => setPhase(e.target.value as InflightPhase)}
                className="min-h-[32px] rounded-md border border-input bg-card px-2 text-xs">
                {PHASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">When</span>
              <select value={ago} onChange={(e) => setAgo(Number(e.target.value))}
                className="min-h-[32px] rounded-md border border-input bg-card px-2 text-xs">
                {AGO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} aria-label="Note (optional)"
            placeholder="Note (optional), e.g. controlled rest taken" className="text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={kss == null} onClick={save}>Log rating</Button>
            {saved && <p role="status" className="text-xs text-muted-foreground">{saved}</p>}
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-3 text-sm" aria-label="Your ratings on this duty">
          {mine.map((e) => (
            <li key={e.clientId} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono tabular">{homeTz ? formatHomeTime(e.recordedAtUtc, homeTz) : e.recordedAtUtc.slice(11, 16) + 'Z'}</span>
                <span>KSS {e.kss}</span>
                <span className="truncate text-xs text-muted-foreground">{PHASES.find(([v]) => v === e.phase)?.[1] ?? ''}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {e.status === 'synced'
                  ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" aria-hidden="true" />In your account{e.predictedKss != null ? ` · model ${e.predictedKss.toFixed(1)}` : ''}</span>
                  : e.status === 'rejected' ? <span className="text-destructive">{e.reason}</span>
                  : <span>On this device</span>}
                <button type="button" aria-label={`Delete rating KSS ${e.kss}`} onClick={() => void remove(e)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {loadError && <p role="status" className="text-xs text-muted-foreground">{loadError}</p>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {syncing ? 'Sending your ratings… ' : syncError ? `${syncError} They stay on this device. ` : ''}
        {isAuthenticated
          ? 'Ratings are private unless you separately choose to contribute to the model study. Delete them here or manage your choice in your account. '
          : 'Guest ratings stay on this device. Sign in before logging future ratings to save those with your account. '}
        This log does not replace your operator’s fatigue reporting.
      </p>
    </section>
  );
}
