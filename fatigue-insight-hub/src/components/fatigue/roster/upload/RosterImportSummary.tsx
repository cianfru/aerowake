import { forwardRef, useId, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, Loader2, Play } from 'lucide-react';
import type { RosterPreview } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { HomeBaseSummary } from './HomeBaseSummary';
import { PreviewDutyList } from './PreviewDutyList';
import { conventionLabel, formatLabel, hhmm, monthInWords, needsConfirmation, notes, warnings } from './import-format';

interface RosterImportSummaryProps {
  preview: RosterPreview;
  /** A new preview is loading (base change). */
  refreshing: boolean;
  analysing: boolean;
  baseError?: string;
  analyseError?: string;
  onChangeBase: (base: string, override: boolean) => void;
  onUseRosterBase: () => void;
  onAnalyse: () => void;
  onChooseAnother: () => void;
}

function dutyBreakdown(p: RosterPreview) {
  const parts = [
    p.flight_duties ? `${p.flight_duties} flight` : null,
    p.training_duties ? `${p.training_duties} training` : null,
    p.airport_standbys ? `${p.airport_standbys} airport standby` : null,
  ].filter(Boolean);
  return parts.length > 1 ? parts.join(' · ') : undefined;
}

/**
 * What Aerowake read from the roster, in plain words, with one primary action.
 * The confirmation checkbox appears only when something is flagged.
 */
export const RosterImportSummary = forwardRef<HTMLHeadingElement, RosterImportSummaryProps>(function RosterImportSummary(
  { preview, refreshing, analysing, baseError, analyseError, onChangeBase, onUseRosterBase, onAnalyse, onChooseAnother },
  headingRef,
) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const confirmId = useId();
  const errorId = useId();
  const flagged = warnings(preview);
  const info = notes(preview);
  const mustConfirm = needsConfirmation(preview);
  const inferredBase = preview.base_source === 'duty_pattern';
  const busy = refreshing || analysing;

  const confirmLabel = inferredBase && flagged.length
    ? `${preview.home_base} is my home base, and I've checked the flagged items above.`
    : inferredBase ? `${preview.home_base} is my home base.` : "I've checked the flagged items above.";

  const blockMatches = preview.block_total_matches_source;
  const blockSub = blockMatches === true
    ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" aria-hidden="true" />Matches roster total</span>
    : blockMatches === false && preview.source_block_hours != null
      ? <span className="inline-flex items-center gap-1 text-foreground"><AlertTriangle className="h-3 w-3 text-warning" aria-hidden="true" />Roster says {hhmm(preview.source_block_hours)}</span>
      : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mustConfirm && !confirmed) {
      setConfirmMissing(true);
      checkboxRef.current?.focus();
      return;
    }
    onAnalyse();
  };

  return (
    <section aria-labelledby={`${confirmId}-heading`} aria-busy={refreshing || undefined} className="space-y-6 rounded-xl border border-border bg-card/60 p-4 sm:p-5 md:p-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{formatLabel(preview.roster_format)}</p>
        <h2 id={`${confirmId}-heading`} ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
          {monthInWords(preview.month)} roster
        </h2>
        <p className="text-sm text-muted-foreground">{conventionLabel(preview.time_convention)}.</p>
      </div>

      <HomeBaseSummary
        preview={preview}
        busy={busy}
        error={baseError}
        onChange={onChangeBase}
        onUseRosterBase={onUseRosterBase}
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Duties" value={preview.total_duties} sub={dutyBreakdown(preview)} />
        <Stat label="Sectors" value={preview.total_sectors} />
        <Stat label="Home standby" value={preview.standby_periods} />
        <Stat label="Block time" value={hhmm(preview.calendar_month_block_hours)} sub={blockSub} />
      </dl>

      {flagged.length > 0 && (
        <ul className="space-y-2" aria-label="Flagged for checking">
          {flagged.map(w => (
            <li key={w.code + w.message} className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {info.length > 0 && (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {info.map(n => (
            <li key={n.code} className="flex gap-2"><Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{n.message}</span></li>
          ))}
        </ul>
      )}

      <PreviewDutyList preview={preview} />

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mustConfirm && (
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                ref={checkboxRef}
                type="checkbox"
                checked={confirmed}
                onChange={e => { setConfirmed(e.target.checked); if (e.target.checked) setConfirmMissing(false); }}
                aria-invalid={confirmMissing || undefined}
                aria-describedby={confirmMissing ? `${confirmId}-missing` : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
              />
              <span>{confirmLabel}</span>
            </label>
            {confirmMissing && (
              <p id={`${confirmId}-missing`} className="text-sm font-medium text-destructive">Tick the box to confirm before analysing.</p>
            )}
          </div>
        )}

        {analyseError && (
          <div id={errorId} role="alert" className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <span>{analyseError}</span>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="submit"
            variant="glow"
            className="h-12 w-full sm:w-auto sm:px-7"
            aria-disabled={busy || undefined}
            aria-describedby={analyseError ? errorId : undefined}
          >
            {analysing
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Analysing…</>
              : <><Play className="h-4 w-4" aria-hidden="true" />Analyse roster</>}
          </Button>
          <Button type="button" variant="ghost" className="h-12 w-full sm:w-auto" onClick={() => { if (!analysing) onChooseAnother(); }} aria-disabled={analysing || undefined}>
            Choose another file
          </Button>
        </div>
      </form>
    </section>
  );
});

/** A labelled figure (same look as the workspace `Figure`) with list semantics. */
const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="min-w-0 space-y-1">
    <dt className="eyebrow">{label}</dt>
    <dd className="font-mono text-xl font-medium leading-none tabular-nums md:text-2xl">{value}</dd>
    {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
  </div>
);
