import { useState } from 'react';
import { BedDouble, Info, Moon, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ReportTimeInput } from '@/components/fatigue/fatigue-report/ReportTimeInput';
import { formatHomeDate, formatHomeTime, zoneOffsetLabel } from '@/lib/home-time';
import { addBlock, editForBlock, removeBlock, removedIn, restoreBlock, retimeBlock, undoEdit } from '@/lib/sleep-edits';
import { useSaveSleepEdits } from '@/hooks/useSaveSleepEdits';
import { cn } from '@/lib/utils';
import type { SleepEditItem, SleepQualityFactors, SleepReference } from '@/types/fatigue';

export interface ListedSleepBlock {
  sleepStartUtc?: string;
  sleepEndUtc?: string;
  sleepType?: string;
  durationHours?: number;
  effectiveHours?: number;
  basis?: string;
  source?: 'estimated' | 'pilot';
  qualityFactors?: SleepQualityFactors;
  environment?: string;
}

/** What each quality factor means, with its source (shown in the "why" panel). */
const FACTORS: Partial<Record<keyof SleepQualityFactors, { label: string; text: string }>> = {
  base_efficiency: { label: 'Place', text: 'Assumed sleep efficiency for the environment; this is not a measured home or hotel value. Signal et al. (2013) studied in-flight rest.' },
  wocl_boost: { label: 'Body-clock timing', text: 'Sleep out of step with the body clock is less efficient (Dijk & Czeisler 1994).' },
  late_onset_penalty: { label: 'Late start', text: 'A late bedtime shortens the sleep opportunity.' },
  recovery_boost: { label: 'Recovery', text: 'Sleep after a short night is deeper (Borbély 1982).' },
  time_pressure_factor: { label: 'Early alarm', text: 'An early report time disturbs the end of sleep (Kecklund & Åkerstedt 2004).' },
  insufficient_penalty: { label: 'Short sleep', text: 'A short sleep restores less than its length suggests.' },
};

function span(startUtc: string | undefined, endUtc: string | undefined, tz: string) {
  const date = formatHomeDate(startUtc, tz).split(' ').slice(0, 2).join(' ');
  return { date, times: `${formatHomeTime(startUtc, tz)}–${formatHomeTime(endUtc, tz)}` };
}

function WhyPanel({ block, rationale, confidence, confidenceBasis, references, onChange, onRemove, onRestore, busy }: {
  block: ListedSleepBlock; rationale?: string; confidence?: number; confidenceBasis?: string;
  references?: SleepReference[]; onChange: () => void; onRemove: () => void; onRestore?: () => void; busy: boolean;
}) {
  const pilot = block.source === 'pilot';
  const nap = block.sleepType === 'nap';
  const factors = Object.entries(block.qualityFactors ?? {})
    .filter(([k, v]) => FACTORS[k as keyof SleepQualityFactors] && typeof v === 'number' && Math.abs(v - 1) >= 0.01);
  const restful = block.durationHours && block.effectiveHours != null
    ? Math.round((block.effectiveHours / block.durationHours) * 100) : null;
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{pilot ? `${nap ? 'Nap' : 'Sleep'} you set` : nap ? 'Why this nap' : 'Why this sleep'}</p>
      <p className="leading-relaxed text-muted-foreground">
        {block.basis ?? rationale ?? 'Estimated from your roster for an average pilot.'}
      </p>
      {!pilot && confidence != null && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          <p><span className="text-muted-foreground">Assumption rating </span><span className="font-mono tabular">{Math.round(confidence * 100)}/100</span></p>
          <p className="leading-relaxed text-muted-foreground">A heuristic rating of the sleep assumptions, not a calibrated probability or a measure of actual sleep.</p>
          {confidenceBasis && !/^Confidence: \d+%$/.test(confidenceBasis) && <p className="leading-relaxed text-muted-foreground">{confidenceBasis}</p>}
        </div>
      )}
      {(restful != null || factors.length > 0) && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          {restful != null && (
            <p><span className="text-muted-foreground">Counted as restful </span>
              <span className="font-mono tabular">{(block.effectiveHours ?? 0).toFixed(1)}h of {(block.durationHours ?? 0).toFixed(1)}h ({restful} %)</span></p>
          )}
          {factors.map(([k, v]) => {
            const f = FACTORS[k as keyof SleepQualityFactors]!;
            return (
              <p key={k} className="leading-relaxed text-muted-foreground">
                <span className="text-foreground">{f.label} ×{(v as number).toFixed(2)}</span> — {f.text}
              </p>
            );
          })}
        </div>
      )}
      {references && references.length > 0 && (
        <details className="border-t border-border pt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Sources ({references.length})</summary>
          <ul className="mt-1.5 space-y-1 text-muted-foreground">
            {references.map((r) => <li key={r.key} className="leading-relaxed">{r.full}</li>)}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onChange}>Change times</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRemove}>
          {nap ? (pilot ? 'Remove' : 'I don’t nap here') : 'Remove'}
        </Button>
        {pilot && onRestore && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onRestore}>Use the estimate</Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Your changes re-run the fatigue model and stay with this roster. They are planned sleep, not sleep you report having had.
      </p>
    </div>
  );
}

function TimesEditor({ initialStart, initialEnd, tz, onCancel, onSave, busy, kindChoice }: {
  initialStart: string; initialEnd: string; tz: string; busy: boolean; kindChoice?: boolean;
  onCancel: () => void; onSave: (startUtc: string, endUtc: string, kind: 'main' | 'nap') => void;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [kind, setKind] = useState<'main' | 'nap'>('nap');
  const zone = `home base · ${zoneOffsetLabel(tz, initialStart)}`;
  const hours = (Date.parse(end) - Date.parse(start)) / 3600000;
  const error = !(hours > 0) ? 'The end must be after the start.'
    : hours > 14 ? 'Enter at most 14 hours.' : null;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
      {kindChoice && (
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Kind of sleep">
          {(['nap', 'main'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={cn('min-h-[32px] rounded-md px-3 font-medium', kind === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              {k === 'nap' ? 'Nap' : 'Main sleep'}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <ReportTimeInput label="Asleep from" value={start} onChange={setStart} tz={tz} zone={zone} compact />
        <ReportTimeInput label="Awake at" value={end} onChange={setEnd} tz={tz} zone={zone} compact />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy || !!error} onClick={() => onSave(start, end, kind)}>
          {busy ? 'Recalculating…' : 'Save and recalculate'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Estimated (and pilot-set) sleep with the reason for each block and the
 * controls to remove it, change its times or add a nap.
 */
export function SleepBlockList({ blocks, homeTz, rationale, confidence, confidenceBasis, references, window: win, addDefault, ariaLabel }: {
  blocks: ListedSleepBlock[];
  homeTz: string;
  /** Why the entry's strategy places its main sleep (for blocks without their own basis). */
  rationale?: string;
  confidence?: number;
  confidenceBasis?: string;
  references?: SleepReference[];
  /** Where removed estimates are listed: from the previous release to this report. */
  window?: { from?: string; to: string };
  /** Default times offered when adding a nap. */
  addDefault?: { startUtc: string; endUtc: string };
  ariaLabel: string;
}) {
  const { edits, save, isSaving, canEdit } = useSaveSleepEdits();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = blocks.filter((b) => b.sleepStartUtc && b.sleepEndUtc)
    .sort((a, b) => Date.parse(a.sleepStartUtc!) - Date.parse(b.sleepStartUtc!));
  const removed = win ? removedIn(edits, win.from, win.to) : [];

  const commit = (next: SleepEditItem[], message: string) => {
    save(next, message);
    setEditing(null);
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1" aria-label={ariaLabel}>
        {sorted.map((b) => {
          const key = b.sleepStartUtc!;
          const nap = b.sleepType === 'nap';
          const pilot = b.source === 'pilot';
          const { date, times } = span(b.sleepStartUtc, b.sleepEndUtc, homeTz);
          return (
            <li key={key} className="space-y-2">
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-2">
                    {nap ? <Moon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : <BedDouble className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span>{nap ? 'Nap' : 'Sleep'}
                      <span className="text-xs text-muted-foreground">{pilot ? ' · set by you' : nap ? ' · assumed' : ''}</span>
                    </span>
                  </span>
                  <span className="whitespace-nowrap pl-[1.375rem] font-mono tabular sm:pl-0">
                    <span className="mr-1.5 font-sans text-muted-foreground">{date}</span>
                    {times}
                    {b.durationHours != null && <span className="ml-2 text-muted-foreground">{b.durationHours.toFixed(1)}h</span>}
                  </span>
                </span>
                <span className="-mt-1 flex items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" aria-label={`Why this ${nap ? 'nap' : 'sleep'}, ${date} ${times}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" collisionPadding={16} className="max-h-[70vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto p-4">
                      <WhyPanel block={b} rationale={nap ? undefined : rationale} confidence={confidence}
                        confidenceBasis={confidenceBasis} references={references} busy={isSaving || !canEdit}
                        onChange={() => setEditing(key)}
                        onRemove={() => commit(removeBlock(edits, b), nap ? 'Nap removed and fatigue recalculated' : 'Sleep removed and fatigue recalculated')}
                        onRestore={editForBlock(edits, b) ? () => commit(restoreBlock(edits, b), 'Estimate restored') : undefined} />
                    </PopoverContent>
                  </Popover>
                </span>
              </div>
              {editing === key && (
                <TimesEditor initialStart={b.sleepStartUtc!} initialEnd={b.sleepEndUtc!} tz={homeTz} busy={isSaving}
                  onCancel={() => setEditing(null)}
                  onSave={(s, e) => commit(retimeBlock(edits, b, s, e), 'Sleep times saved and fatigue recalculated')} />
              )}
            </li>
          );
        })}
        {removed.map((e) => {
          const { date, times } = span(e.targetStartUtc ?? undefined, e.targetEndUtc ?? undefined, homeTz);
          return (
            <li key={e.id} className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="line-through decoration-muted-foreground/60">{e.kind === 'nap' ? 'Assumed nap' : 'Estimated sleep'} removed</span>
                <span className="whitespace-nowrap font-mono tabular"><span className="mr-1.5 font-sans">{date}</span>{times}</span>
              </span>
              <button type="button" disabled={isSaving}
                onClick={() => commit(undoEdit(edits, e.id), 'Estimate restored')}
                className="min-h-[28px] px-1 text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50">Undo</button>
            </li>
          );
        })}
      </ul>
      {addDefault && canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add a nap or sleep
        </button>
      )}
      {adding && addDefault && (
        <TimesEditor initialStart={addDefault.startUtc} initialEnd={addDefault.endUtc} tz={homeTz} busy={isSaving} kindChoice
          onCancel={() => setAdding(false)}
          onSave={(s, e, kind) => commit(addBlock(edits, kind, s, e), 'Sleep added and fatigue recalculated')} />
      )}
      {edits.some((e) => !e.applied) && (
        <p className="text-xs text-muted-foreground">
          Some of your earlier sleep changes no longer match this roster’s estimates and are not applied.
        </p>
      )}
      {!canEdit && sorted.length > 0 && (
        <p className="text-xs text-muted-foreground">Analyse the roster to change these sleeps.</p>
      )}
    </div>
  );
}
