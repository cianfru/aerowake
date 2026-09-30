import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BedDouble, CalendarClock, Check, ClipboardList, Info,
  Loader2, Plane, Plus, Trash2, UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { getAirportCoordinatesAsync } from '@/lib/airport-api';
import { cn } from '@/lib/utils';
import { DEFAULT_WATCH_KSS, watchReference } from '@/lib/roster-forecast';
import {
  dutiesInPeriod, dutyFromAnalysis, estimatedSleepsFromAnalysis, generateFatigueReport, localInputToUtcIso,
  type DutyStatus, type EventType, type FatigueReport, type ReportDuty, type ReportSector, type ReportSleep,
} from '@/lib/fatigue-report-api';
import { buildDiaryDays, diaryDate, shiftDay, formatHours, overlaps, priorSleepHours } from '@/lib/report-diary';
import { formatLocal, formatUtcOffset, zoneLabel } from '@/lib/report-time';
import {
  FUTURE_DUTY_NOTICE, confirmableSleeps, duringDutyError, eventTimeError, isFuture, operatedCandidates, prefillEvent,
  statusBlockedReason, stepBlockers,
} from '@/lib/report-wizard';
import { ReportDaybook } from './ReportDaybook';
import { FatigueReportView } from './FatigueReportView';
import { ReportTimeInput } from './ReportTimeInput';
import { ReportAccountStep, type OperationalInput, type PilotDetails } from './ReportAccountStep';

const STEPS = [
  { id: 'event', label: 'Event', icon: CalendarClock },
  { id: 'duties', label: 'Recent duties', icon: Plane },
  { id: 'sleep', label: 'Sleep & recovery', icon: BedDouble },
  { id: 'feel', label: 'Your account', icon: UserRound },
] as const;

const field = 'block space-y-1.5 text-sm';
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground scroll-mb-28 disabled:opacity-60';

const STATUS_LABEL: Record<DutyStatus, string> = {
  operated: 'Operated',
  planned: 'Planned / not confirmed',
  cancelled_fatigue: 'Not operated – fatigue',
  not_operated: 'Not operated – other reason',
};

const EMPTY_OPERATIONAL: OperationalInput = { crewPosition: '', pilotRole: '', phase: '', mitigations: [], effect: '', suggestedAction: '' };
const DRAFT_KEY = 'aerowake-report-draft-v1';

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
const minuteNow = () => Math.floor(Date.now() / 60000) * 60000;

function hoursBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600e3;
  return Number.isFinite(h) ? h : null;
}

function fmtH(h: number | null): string {
  if (h == null) return '—';
  const whole = Math.floor(h);
  return `${whole}h${String(Math.round((h - whole) * 60)).padStart(2, '0')}`;
}

/** Keeps focused fields clear of the sticky action bar while the wizard is mounted. */
function useScrollPaddingBottom(padding: string) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = padding;
    return () => { root.style.scrollPaddingBottom = previous; };
  }, [padding]);
}

export function FatigueReportPage() {
  const { state, clearFatigueReportPrefill } = useAnalysis();
  const { fatigueReportPrefill } = state;
  const results = state.analysisResults?.legacyModel ? null : state.analysisResults;
  useScrollPaddingBottom('7rem');
  const [diaryComplete, setDiaryComplete] = useState(false);

  const [saveDraft, setSaveDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [report, setReport] = useState<FatigueReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState('');
  const [nowMs, setNowMs] = useState(minuteNow);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setNowMs(minuteNow()), 60000); return () => clearInterval(t); }, []);

  // Home base & time display
  const [homeBase, setHomeBase] = useState(results?.pilotBase ?? state.settings.homeBase ?? '');
  const [homeTz, setHomeTz] = useState(results?.homeBaseTimezone ?? '');
  const [timeMode, setTimeMode] = useState<'local' | 'utc'>('local');
  // No time is ever captured before the zone is known: inputs stay locked until then.
  const inputTz = !homeTz ? '' : timeMode === 'utc' ? 'UTC' : homeTz;

  // Event
  const [eventType, setEventType] = useState<EventType>('fatigue_call_before_duty');
  // Personal roster setting: carried into the JSON export only, never printed.
  const [watchKss, setWatchKss] = useState(DEFAULT_WATCH_KSS);
  const prospective = eventType === 'roster_concern';
  const [eventTime, setEventTime] = useState(() => new Date(minuteNow()).toISOString());
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 3 * 86400e3).toISOString());
  const [periodEnd, setPeriodEnd] = useState(new Date(Date.now() + 12 * 3600e3).toISOString());

  // Duties & sleep
  const [duties, setDuties] = useState<ReportDuty[]>([]);
  const [affectedId, setAffectedId] = useState<string | null>(null);
  const [sleeps, setSleeps] = useState<(ReportSleep & { key: string })[]>([]);
  const [prefilledFor, setPrefilledFor] = useState('');

  // Account
  const [kss, setKss] = useState<number | null>(null);
  const [ratedAt, setRatedAt] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');
  const [sp, setSp] = useState<number | null>(null);
  const [factors, setFactors] = useState<string[]>([]);
  const [narrative, setNarrative] = useState('');
  const [operational, setOperational] = useState<OperationalInput>(EMPTY_OPERATIONAL);
  const rosterPilot = (): PilotDetails => ({
    name: results?.pilotName ?? '', staff_number: results?.pilotId ?? '', rank: '', fleet: results?.pilotAircraft ?? '', operator: '',
  });
  const [pilot, setPilot] = useState<PilotDetails>(rosterPilot);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.version === 1 && Array.isArray(draft.duties) && Array.isArray(draft.sleeps)) {
          setHomeBase(draft.homeBase); setTimeMode(draft.timeMode); setEventType(draft.eventType);
          setWatchKss(watchReference(draft.watchKss));
          setEventTime(draft.eventTime); setPeriodStart(draft.periodStart); setPeriodEnd(draft.periodEnd);
          setDuties(draft.duties); setSleeps(draft.sleeps); setAffectedId(draft.affectedId);
          setKss(draft.kss); setSp(draft.sp); setRatedAt(draft.ratedAt ?? ''); setFactors(draft.factors); setNarrative(draft.narrative);
          setOperational({ ...EMPTY_OPERATIONAL, ...(draft.operational ?? {}) });
          setPilot(draft.pilot); setDiaryComplete(draft.diaryComplete); setPrefilledFor('restored');
          setSaveDraft(true);
        }
      }
    } catch { setError('The saved draft could not be restored.'); }
    setDraftLoaded(true);
  }, []);
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (saveDraft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: 1, homeBase, timeMode, eventType, eventTime, periodStart, periodEnd, duties, sleeps,
        affectedId, kss, sp, ratedAt, factors, narrative, pilot, diaryComplete, watchKss, operational,
      }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { setError('This browser could not save the draft. Keep this tab open.'); }
  }, [draftLoaded, saveDraft, homeBase, timeMode, eventType, eventTime, periodStart, periodEnd,
      duties, sleeps, affectedId, kss, sp, ratedAt, factors, narrative, pilot, diaryComplete, watchKss, operational]);
  useEffect(() => {
    if (saveDraft || (!duties.length && !sleeps.length && !narrative)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveDraft, duties.length, sleeps.length, narrative]);

  // Resolve the home-base time zone (IATA, three letters).
  useEffect(() => {
    setHomeTz('');
    setLookupError('');
    const code = homeBase.trim().toUpperCase();
    if (code.length !== 3) return;
    let cancelled = false;
    getAirportCoordinatesAsync(code).then((a) => {
      if (cancelled) return;
      setHomeTz(a?.timezone ?? '');
      setLookupError(a ? '' : `${code} was not found. Check the three-letter IATA code.`);
    }).catch(() => { if (!cancelled) setLookupError('The airport could not be looked up. Check your connection and try again.'); });
    return () => { cancelled = true; };
  }, [homeBase, results?.homeBaseTimezone]);

  // Pre-fill duties and estimated sleep from the loaded roster.
  const periodKey = `${periodStart}|${periodEnd}`;
  const runPrefill = (opts: { start: string; end: string; event: string; affected?: string | null; replacementConfirmed?: boolean }) => {
    if (!results) return;
    if (!opts.replacementConfirmed && (duties.length || sleeps.length || narrative) && !window.confirm('Replace the current duties and sleep entries with estimates from the roster?')) return;
    const found = dutiesInPeriod(results, opts.start, opts.end);
    // A duty that straddles the start of the period is included whole, so the period grows to fit it.
    const earliest = Math.min(Date.parse(opts.start), ...found.map((d) => Date.parse(d.report_utc)));
    const start = new Date(earliest).toISOString();
    if (start !== opts.start) setPeriodStart(start);
    const eventMs = new Date(opts.event).getTime();
    const target = opts.affected
      ? found.find((d) => d.id === opts.affected)
      : found.find((d) => new Date(d.release_utc).getTime() >= eventMs);
    setDuties(found); // Roster entries are planned until the pilot confirms what happened.
    setSleeps(estimatedSleepsFromAnalysis(results, opts.start, opts.end).map((s) => ({ ...s, key: newId('s') })));
    setAffectedId(target?.id ?? null);
    setDiaryComplete(false);
    setPrefilledFor(`${start}|${opts.end}`);
  };
  const prefill = () => runPrefill({ start: periodStart, end: periodEnd, event: eventTime });

  // "Report fatigue" on a roster duty: pre-select that duty once, then clear the request.
  useEffect(() => {
    const req = fatigueReportPrefill;
    if (!req || !draftLoaded) return;
    clearFatigueReportPrefill();
    if (!results) return;
    const idx = results.duties.findIndex((d) => d.dutyId === req.dutyId);
    const rd = idx >= 0 ? dutyFromAnalysis(results.duties[idx], idx) : null;
    if (!rd) return;
    if ((duties.length || sleeps.length || narrative) && !window.confirm('Replace the current event, duties and sleep entries with this roster duty?')) return;
    setHomeBase(results.pilotBase || homeBase);
    setReport(null);
    const reportMs = Date.parse(rd.report_utc);
    // A duty that has not started yet can only be a roster concern (or a fatigue call made now).
    const { type, eventIso, futureDuty } = prefillEvent(rd.report_utc, req.purpose, minuteNow());
    const start = new Date(Math.min(reportMs, Date.parse(eventIso)) - 3 * 86400e3).toISOString();
    const end = new Date(Math.max(reportMs + 18 * 3600e3, Date.parse(rd.release_utc))).toISOString();
    setEventType(type);
    setNotice(futureDuty && type === 'roster_concern' ? FUTURE_DUTY_NOTICE : '');
    setWatchKss(watchReference(req.watchReference ?? DEFAULT_WATCH_KSS));
    setKss(null); setSp(null); setRatedAt(''); setFactors([]); setNarrative(''); setOperational(EMPTY_OPERATIONAL);
    setPilot((p) => ({ ...rosterPilot(), rank: p.rank, operator: p.operator }));
    setEventTime(eventIso);
    setPeriodStart(start);
    setPeriodEnd(end);
    runPrefill({ start, end, event: eventIso, affected: rd.id, replacementConfirmed: true });
    setAttempted(false);
    setStep(0);
    // Run once per prefill request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fatigueReportPrefill, draftLoaded]);

  const changeEventTime = (value: string) => {
    const delta = Date.parse(value) - Date.parse(eventTime);
    setEventTime(value);
    if (Number.isFinite(delta)) {
      setPeriodStart(new Date(Date.parse(periodStart) + delta).toISOString());
      setPeriodEnd(new Date(Date.parse(periodEnd) + delta).toISOString());
    }
    setDiaryComplete(false);
  };
  const changeEventType = (type: EventType) => {
    setEventType(type);
    setDiaryComplete(false);
    setNotice('');
    // Switching from a concern to a report about the past: move a future event time to now.
    if (type !== 'roster_concern' && isFuture(eventTime, nowMs)) {
      changeEventTime(new Date(minuteNow()).toISOString());
      setNotice('The event time was moved to now, because this report describes something that has already happened. Adjust it if needed.');
    }
    if (type !== 'fatigue_during_duty') setOperational((o) => ({ ...o, phase: '' }));
  };

  const diaryTz = inputTz || 'UTC';
  const diaryDays = useMemo(() => buildDiaryDays(periodStart, periodEnd, eventTime, diaryTz, duties, sleeps), [periodStart, periodEnd, eventTime, diaryTz, duties, sleeps]);
  const activeDay = diaryDays.find(d => d.date === selectedDay);
  const dayFilter = activeDay ? selectedDay : 'all';
  const includesDay = (start: string, end: string) => !activeDay || overlaps(start, end, activeDay.start, activeDay.end);
  const sortedDuties = [...duties].sort((a, b) => a.report_utc.localeCompare(b.report_utc));
  const visibleDuties = sortedDuties.filter(d => includesDay(d.report_utc, d.release_utc));
  const visibleSleeps = [...sleeps].sort((a, b) => a.start_utc.localeCompare(b.start_utc)).filter(s => includesDay(s.start_utc, s.end_utc));
  const entryDay = activeDay?.date ?? diaryDate(eventTime, diaryTz);
  const setPeriod = (setter: (value: string) => void, value: string) => { setter(value); setDiaryComplete(false); };

  // ── Duty editing ──
  const updateDuty = (id: string, patch: Partial<ReportDuty>) => {
    setDiaryComplete(false);
    setDuties((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const updateSector = (id: string, i: number, patch: Partial<ReportSector>) =>
    setDuties((ds) => ds.map((d) => (d.id === id
      ? { ...d, sectors: d.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d)));
  const addDuty = () => {
    const report = localInputToUtcIso(`${entryDay}T08:00`, diaryTz);
    if (!report) { setError('Choose UTC to enter a duty on this date.'); return; }
    setDiaryComplete(false);
    const release = new Date(new Date(report).getTime() + 8 * 3600e3).toISOString();
    const duty: ReportDuty = {
      id: newId('d'), report_utc: report, release_utc: release, sectors: [], status: 'planned',
      duty_type: 'flight', source: 'manual',
    };
    setDuties((ds) => [...ds, duty].sort((a, b) => a.report_utc.localeCompare(b.report_utc)));
  };
  const addSector = (d: ReportDuty) => {
    const last = d.sectors[d.sectors.length - 1];
    const dep = last ? new Date(new Date(last.arrival_utc).getTime() + 45 * 60e3) : new Date(new Date(d.report_utc).getTime() + 60 * 60e3);
    updateDuty(d.id, {
      sectors: [...d.sectors, {
        flight_number: '', departure: last?.arrival ?? homeBase.toUpperCase(), arrival: '',
        departure_utc: dep.toISOString(), arrival_utc: new Date(dep.getTime() + 2 * 3600e3).toISOString(),
      }],
    });
  };
  const operatedIds = operatedCandidates(duties, eventTime, nowMs);
  const markOperated = () => {
    setDiaryComplete(false);
    setDuties((ds) => ds.map((d) => (operatedIds.includes(d.id) ? { ...d, status: 'operated' } : d)));
  };

  // ── Sleep editing ──
  const updateSleep = (key: string, patch: Partial<ReportSleep>) => {
    setDiaryComplete(false);
    setSleeps((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };
  const addSleep = (kind: 'main' | 'nap') => {
    const startIso = localInputToUtcIso(kind === 'nap' ? `${entryDay}T14:00` : `${shiftDay(entryDay, -1)}T23:00`, diaryTz);
    if (!startIso) { setError('Choose UTC to enter sleep on this date.'); return; }
    const start = new Date(startIso);
    const hours = kind === 'nap' ? 1 : 8;
    setDiaryComplete(false);
    const entry: ReportSleep & { key: string } = {
      key: newId('s'), start_utc: start.toISOString(),
      end_utc: new Date(start.getTime() + hours * 3600e3).toISOString(),
      kind, location: 'home', quality: null, source: 'reported',
    };
    setSleeps((ss) => [...ss, entry].sort((a, b) => a.start_utc.localeCompare(b.start_utc)));
  };
  const confirmKeys = confirmableSleeps(sleeps, eventTime, nowMs);
  const confirmPastSleep = () => {
    setDiaryComplete(false);
    setSleeps((ss) => ss.map((s) => (confirmKeys.includes(s.key) ? { ...s, source: 'reported' } : s)));
  };

  const dutyIssues = useMemo(() => {
    const issues: string[] = [];
    const ordered = [...duties].sort((a, b) => a.report_utc.localeCompare(b.report_utc));
    const active = ordered.filter(d => ['operated', 'planned'].includes(d.status));
    ordered.forEach((d, index) => {
      const duration = hoursBetween(d.report_utc, d.release_utc);
      if (duration == null || duration <= 0) issues.push(`Duty ${index + 1}: release must be after report. For an overnight duty, move the release to the next date.`);
      else if (duration > 24) issues.push(`Duty ${index + 1}: check the dates; a single duty cannot exceed 24 hours in this report.`);
      if (Date.parse(d.report_utc) < Date.parse(periodStart) || Date.parse(d.release_utc) > Date.parse(periodEnd) + 86400e3) issues.push(`Duty ${index + 1}: extend the reporting period in step 1 to include this duty.`);
    });
    active.forEach((d, index) => { if (index && Date.parse(d.report_utc) < Date.parse(active[index - 1].release_utc)) issues.push('Two active duties overlap. Review their report and release dates.'); });
    return [...new Set(issues)];
  }, [duties, periodStart, periodEnd]);

  const sleepIssues = useMemo(() => {
    const issues: string[] = [];
    const sorted = [...sleeps].sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    sorted.forEach((s, i) => {
      if (s.end_utc <= s.start_utc) issues.push(`Sleep ${i + 1}: wake time is before sleep time.`);
      if (i && s.start_utc < sorted[i - 1].end_utc) issues.push(`Sleep ${i + 1} overlaps the previous sleep.`);
      if (s.source === 'reported' && isFuture(s.end_utc, nowMs)) issues.push(`Sleep ${i + 1} ends in the future; keep it as an estimate.`);
    });
    return issues;
  }, [sleeps, nowMs]);

  const ratingSet = kss !== null || sp !== null;
  const ratedAtError = ratingSet && !ratedAt ? 'Enter when you recorded these ratings.'
    : ratingSet && isFuture(ratedAt, nowMs) ? 'A rating must describe how you felt at a time that has passed.' : null;
  const stepState = { homeTz, eventType, eventIso: eventTime, periodStart, periodEnd, duties, affectedId, dutyIssues, sleepIssues, now: nowMs };
  const blockers = [0, 1, 2].map((s) => stepBlockers(s, stepState));
  const finalBlockers = ratedAtError ? [ratedAtError] : [];
  const currentBlockers = step < 3 ? blockers[step] : finalBlockers;
  const eventError = eventTimeError(eventType, eventTime, nowMs);
  const unconfirmed = sleeps.filter((s) => s.source === 'estimated').length;
  const eventValid = blockers[0].length === 0;

  /** Brings the first visible error into view and focuses its field. */
  const revealFirstError = () => {
    requestAnimationFrame(() => {
      const el = cardRef.current?.querySelector<HTMLElement>('[data-report-error]');
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const fieldEl = el.closest('div, label, section')?.querySelector<HTMLElement>('input:not([disabled]), select, textarea');
      fieldEl?.focus({ preventScroll: true });
    });
  };

  const goTo = (n: number) => {
    if (n > step && blockers.slice(step, n).some((b) => b.length)) {
      setAttempted(true);
      revealFirstError();
      return;
    }
    setError('');
    setAttempted(false);
    if (n === 1 && results && !prefilledFor && !duties.length && !sleeps.length) prefill();
    setStep(n);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  async function submit() {
    const firstBad = blockers.findIndex((b) => b.length);
    if (firstBad >= 0) { setStep(firstBad); setAttempted(true); revealFirstError(); return; }
    if (finalBlockers.length) { setAttempted(true); revealFirstError(); return; }
    setBusy(true);
    setError('');
    try {
      const r = await generateFatigueReport({
        home_base: homeBase.trim() ? homeBase.trim().toUpperCase() : null,
        home_timezone: homeTz || null,
        event_type: eventType,
        watch_reference_kss: watchKss,
        event_time_utc: eventTime,
        period_start_utc: periodStart,
        period_end_utc: periodEnd,
        affected_duty_id: affectedId,
        diary_complete: diaryComplete,
        duties,
        sleeps: sleeps.map(({ key: _key, ...s }) => s),
        self_assessment: { kss, samn_perelli: sp, rated_at_utc: ratedAt || null },
        contributing_factors: factors,
        narrative,
        pilot,
        crew_position: prospective ? '' : operational.crewPosition,
        pilot_role: prospective ? '' : operational.pilotRole,
        phase_of_flight: eventType === 'fatigue_during_duty' ? operational.phase : '',
        mitigations: prospective ? [] : operational.mitigations,
        effect_on_operation: prospective ? '' : operational.effect,
        suggested_action: operational.suggestedAction,
      });
      setReport(r);
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
      requestAnimationFrame(() => { errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); errorRef.current?.focus(); });
    } finally {
      setBusy(false);
    }
  }

  if (report) {
    return <FatigueReportView report={report} onEdit={() => setReport(null)} />;
  }

  const zone = zoneLabel(timeMode === 'utc' ? null : homeBase, inputTz, eventTime);
  const echoTz = timeMode === 'utc' ? homeTz : undefined;
  const showBlockers = attempted && currentBlockers.length > 0;
  const affectedDuty = duties.find((d) => d.id === affectedId);
  const duringError = duringDutyError(eventType, affectedDuty, eventTime);

  const review = (
    <section aria-label="Before you generate" className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">Before you generate</h2>
      <p className="text-sm text-muted-foreground">{duties.length} {duties.length === 1 ? 'duty' : 'duties'} · {sleeps.filter(s => s.source === 'reported').length} reported sleep periods · {unconfirmed} {unconfirmed === 1 ? 'estimate' : 'estimates'}</p>
      {!affectedId && <p className="text-sm text-muted-foreground">No affected duty selected. The report will describe the event and the period.</p>}
      {!diaryComplete && <p className="text-sm text-muted-foreground">Sleep diary not confirmed complete: the report shows a provisional curve only and no sleep-dependent findings.</p>}
      <p className="text-sm text-muted-foreground">You will review the report before copying or saving it. Nothing is submitted automatically.</p>
    </section>
  );

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 pt-8 md:px-8 md:pt-10">
      <header className="space-y-2">
        <p className="eyebrow">Fatigue report</p>
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-[-0.025em] md:text-[2.5rem]">{prospective ? 'Raise a roster concern' : 'Report fatigue'}</h1>
        <p className="max-w-2xl text-[15px] text-muted-foreground">
          {prospective
            ? 'Planning and using rest is shared between you and your operator. A concern about an upcoming duty helps the operator review it in advance.'
            : 'A fatigue report is a normal safety report within your operator’s fatigue risk management. Confirm what happened, add your account, then export it for your operator.'}
        </p>
      </header>

      {/* Stepper */}
      <nav aria-label="Report steps" className="space-y-3">
        <p className="text-[13px] text-muted-foreground sm:hidden">
          Step {step + 1} of {STEPS.length} · <span className="text-foreground">{STEPS[step].label}</span>
        </p>
        <ol className="grid grid-cols-4 gap-1.5 sm:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.id} className="min-w-0">
              <button type="button" onClick={() => goTo(i)} className="group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.label}`}>
                <span className={cn('block h-[2px] w-full transition-colors', i <= step ? 'bg-foreground' : 'bg-border group-hover:bg-muted-foreground/50')} />
                <span className={cn('mt-2 hidden truncate text-[13px] sm:block', i === step ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                  <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>&nbsp;&nbsp;{s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {(step === 1 || step === 2) && inputTz && <ReportDaybook days={diaryDays} selected={dayFilter} onSelect={setSelectedDay} mode={step === 1 ? 'duties' : 'sleep'} timezone={zone} />}
      <Card variant="glass" ref={cardRef}>
        <CardContent className="space-y-6 p-5 md:p-8">
          {step === 0 && (
            <div className="space-y-6">
              {notice && (
                <p role="status" className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{notice}
                </p>
              )}
              <label className={field}>
                <span className="font-medium">What happened?</span>
                <select className={select} value={eventType} onChange={(e) => changeEventType(e.target.value as EventType)}>
                  <option value="roster_concern">I am concerned about a planned roster</option>
                  <option value="fatigue_call_before_duty">I called fatigue before a duty</option>
                  <option value="fatigue_during_duty">I became fatigued during a duty</option>
                  <option value="fatigue_after_duty">I am reporting fatigue after a duty</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-start">
                <label className={field}>
                  <span className="text-muted-foreground">Home base (IATA)</span>
                  <Input value={homeBase} maxLength={3} placeholder="e.g. LGW" autoCapitalize="characters" className="scroll-mb-28 font-mono uppercase"
                    aria-invalid={!!lookupError} onChange={(e) => setHomeBase(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
                  <span className="block text-xs">
                    {lookupError
                      ? <span role="alert" data-report-error className="text-destructive">{lookupError}</span>
                      : homeTz ? <span className="text-muted-foreground">{homeTz} · {formatUtcOffset(homeTz, eventTime)}</span>
                        : <span className="text-muted-foreground">Times unlock once the base is recognised.</span>}
                  </span>
                </label>
                <div className="space-y-1.5 text-sm">
                  <span className="block text-muted-foreground">Enter times in</span>
                  <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Time entry mode">
                    {(['local', 'utc'] as const).map((m) => {
                      const active = (m === 'utc' ? inputTz === 'UTC' : !!inputTz && inputTz !== 'UTC');
                      return (
                        <button key={m} type="button" disabled={!homeTz} aria-pressed={active} onClick={() => setTimeMode(m)}
                          className={cn('rounded-[4px] px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                            active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                          {m === 'local' ? `${homeBase.length === 3 ? homeBase : 'Base'} local` : 'UTC (Z)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <ReportTimeInput label={prospective ? 'When is the duty or period of concern?' : 'When did you call or feel fatigued?'}
                  tz={inputTz} zone={zone} echoTz={echoTz} value={eventTime} onChange={changeEventTime}
                  error={inputTz ? eventError : null} />
                {!prospective && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={!inputTz} onClick={() => changeEventTime(new Date(minuteNow()).toISOString())}>Now</Button>
                    <Button type="button" variant="outline" size="sm" disabled={!inputTz} onClick={() => changeEventTime(new Date(minuteNow() - 86400e3).toISOString())}>24 hours ago</Button>
                  </div>
                )}
              </div>

              <details className="rounded-lg border border-border p-4" open={attempted && blockers[0].some((b) => b.includes('period')) ? true : undefined}>
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium">Days included</span>{' '}
                  <span className="text-muted-foreground">{inputTz ? `${formatLocal(periodStart, inputTz, { year: false })} – ${formatLocal(periodEnd, inputTz, { year: false })}` : '—'} · change</span>
                </summary>
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Include at least the 2–3 days before the event so the sleep history is complete (up to 31 days).</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReportTimeInput label="From" tz={inputTz} zone={zone} echoTz={echoTz} value={periodStart} onChange={v => setPeriod(setPeriodStart, v)} />
                    <ReportTimeInput label="To" tz={inputTz} zone={zone} echoTz={echoTz} value={periodEnd} onChange={v => setPeriod(setPeriodEnd, v)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[2, 3, 7].map((n) => (
                      <Button key={n} type="button" size="sm" variant="outline" onClick={() => {
                        setDiaryComplete(false);
                        const ev = new Date(eventTime).getTime();
                        setPeriodStart(new Date(ev - n * 86400e3).toISOString());
                        setPeriodEnd(new Date(ev + 18 * 3600e3).toISOString());
                      }}>{n} days before</Button>
                    ))}
                  </div>
                  {blockers[0].filter((b) => /period/.test(b)).map((b) => <p key={b} role="alert" data-report-error className="text-sm text-destructive">{b}</p>)}
                </div>
              </details>

              <p className="text-sm text-muted-foreground">
                {results
                  ? `Duties and estimated sleep are pre-filled from your roster${results.month ? ` (${results.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })})` : ''}. You confirm what actually happened in the next steps.`
                  : 'No roster loaded: enter duties manually, or upload a roster first to pre-fill them.'}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{activeDay ? `Duties · ${activeDay.label}` : 'Duties in this period'}</h2>
                  <p className="text-sm text-muted-foreground">
                    Select the duty of concern. Imported entries stay planned until you confirm what you worked.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {results && <Button type="button" size="sm" variant="outline" onClick={prefill}>Reload from roster</Button>}
                  <Button type="button" size="sm" onClick={addDuty}><Plus className="mr-1 h-4 w-4" />Add duty</Button>
                </div>
              </div>
              {!prospective && operatedIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <span>{operatedIds.length === 1 ? '1 planned duty' : `${operatedIds.length} planned duties`} finished before the event.</span>
                  <Button type="button" size="sm" variant="outline" onClick={markOperated}><Check className="mr-1 h-4 w-4" />Operated as rostered</Button>
                </div>
              )}
              {prefilledFor && prefilledFor !== 'restored' && prefilledFor !== periodKey && <p className="text-sm text-muted-foreground">Your reporting dates have changed. Existing entries have been kept; review them or reload the roster for this period.</p>}
              {visibleDuties.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No duties entered for {activeDay ? activeDay.label : 'this period'}. If you worked, add your report and release times. Leave days off empty.
                </p>
              )}
              {duringError && <p role="alert" data-report-error className="text-sm text-destructive">{duringError}</p>}
              {dutyIssues.map(message => <p key={message} role="alert" data-report-error className="text-sm text-destructive">{message}</p>)}
              {visibleDuties.map((d) => {
                const previousActive = sortedDuties.filter(p => p.id !== d.id && ['operated', 'planned'].includes(p.status) && p.report_utc < d.report_utc);
                const prev = previousActive[previousActive.length - 1];
                const rest = prev && ['operated', 'planned'].includes(d.status) ? hoursBetween(prev.release_utc, d.report_utc) : null;
                const future = isFuture(d.report_utc, nowMs);
                const statusError = statusBlockedReason(d.status, d, eventType, nowMs);
                const scheduled = d.source === 'roster' && d.status === 'planned';
                return (
                  <div key={d.id} className="space-y-2">
                    {rest != null && (
                      <p className={cn('text-sm', rest < 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {rest < 0 ? 'Overlaps previous duty by' : 'Gap after previous duty:'} {fmtH(Math.abs(rest))} · {prev?.status === 'planned' || d.status === 'planned' ? 'includes planned times' : 'reported times'}
                      </p>
                    )}
                    <div className={cn('min-w-0 space-y-4 rounded-lg border p-4', affectedId === d.id && 'border-primary ring-1 ring-primary/40')}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input type="radio" name="affected" checked={affectedId === d.id} onChange={() => setAffectedId(d.id)} />
                          {prospective ? 'Duty of concern' : 'Duty affected by fatigue'}
                        </label>
                        <div className="flex items-center gap-2">
                          {future && <Badge variant="outline">Not started yet</Badge>}
                          <Badge variant="outline">{d.source === 'roster' ? 'From roster' : 'Manual'}</Badge>
                          <Button type="button" size="icon" variant="ghost" aria-label="Remove duty"
                            onClick={() => { setDiaryComplete(false); setDuties(duties.filter((x) => x.id !== d.id)); if (affectedId === d.id) setAffectedId(null); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm font-medium">
                        {d.sectors.length > 0
                          ? `${[...new Set(d.sectors.map((s) => s.flight_number).filter(Boolean))].join('/')} ${[d.sectors[0].departure, ...d.sectors.map((s) => s.arrival)].join('–')}`
                          : 'Duty'}
                        <span className="ml-2 font-normal text-muted-foreground">· {fmtH(hoursBetween(d.report_utc, d.release_utc))}</span>
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ReportTimeInput label={scheduled ? 'Scheduled report' : 'Report'} tz={inputTz} zone={zone} echoTz={echoTz} value={d.report_utc} onChange={(v) => updateDuty(d.id, { report_utc: v })} />
                        <ReportTimeInput label={scheduled ? 'Scheduled release' : 'Release (off duty)'} tz={inputTz} zone={zone} echoTz={echoTz} value={d.release_utc} onChange={(v) => updateDuty(d.id, { release_utc: v })} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={field}>
                          <span className="text-muted-foreground">Status</span>
                          <select aria-label="Status" className={select} value={d.status} aria-invalid={!!statusError} onChange={(e) => updateDuty(d.id, { status: e.target.value as DutyStatus })}>
                            {Object.entries(STATUS_LABEL).map(([v, l]) => {
                              const blocked = statusBlockedReason(v as DutyStatus, d, eventType, nowMs);
                              return <option key={v} value={v} disabled={!!blocked && v !== d.status}>{l}{blocked ? ` (${blocked.toLowerCase()})` : ''}</option>;
                            })}
                          </select>
                          {statusError && <span role="alert" data-report-error className="block text-xs text-destructive">This duty has not started yet. Set it to planned.</span>}
                        </label>
                        <label className={field}><span className="text-muted-foreground">Activity</span><select className={select} value={d.duty_type} onChange={e => updateDuty(d.id, { duty_type: e.target.value as ReportDuty['duty_type'] })}><option value="flight">Flight duty</option><option value="home_standby">Home standby</option><option value="airport_standby">Airport standby</option><option value="standby">Standby · type unconfirmed</option><option value="simulator">Simulator</option><option value="ground">Ground duty</option><option value="positioning">Positioning</option><option value="other">Other duty</option></select></label>
                                              </div>
                      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Crew and acclimatisation (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={field}><span>Crew composition</span><select className={select} value={d.crew_composition ?? 'unknown'} onChange={e => updateDuty(d.id, { crew_composition: e.target.value as ReportDuty['crew_composition'] })}><option value="unknown">Not confirmed</option><option value="standard">Standard · 2 pilots</option><option value="augmented_3">Augmented · 3 pilots</option><option value="augmented_4">Augmented · 4 pilots</option></select></label>
                        <label className={field}><span>Acclimatisation</span><select className={select} value={d.acclimatization ?? 'unknown'} onChange={e => updateDuty(d.id, { acclimatization: e.target.value as ReportDuty['acclimatization'] })}><option value="unknown">Not confirmed</option><option value="acclimatized">Acclimatised to home reference time</option></select></label>
                        <p className="text-xs text-muted-foreground sm:col-span-2">Basic FDP is assessed for confirmed standard, acclimatised crew. Augmented and operator-specific limits need specialist review.</p>
                      </div></details>
                      <details className="rounded-md border border-border p-3" open={d.sectors.length > 0 ? true : undefined}><summary className="cursor-pointer text-sm font-medium">Flight sectors {d.sectors.length ? `(${d.sectors.length})` : '(optional)'}</summary>
                        <div className="mt-3 space-y-4">
                          {d.sectors.map((s, i) => (
                            <div key={i} className="min-w-0 space-y-2 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                                <label className={field}><span className="text-muted-foreground">Flight</span>
                                  <Input value={s.flight_number} maxLength={12} className="scroll-mb-28" onChange={(e) => updateSector(d.id, i, { flight_number: e.target.value.toUpperCase() })} /></label>
                                <label className={field}><span className="text-muted-foreground">From</span>
                                  <Input value={s.departure} maxLength={4} className="scroll-mb-28" onChange={(e) => updateSector(d.id, i, { departure: e.target.value.toUpperCase() })} /></label>
                                <label className={field}><span className="text-muted-foreground">To</span>
                                  <Input value={s.arrival} maxLength={4} className="scroll-mb-28" onChange={(e) => updateSector(d.id, i, { arrival: e.target.value.toUpperCase() })} /></label>
                                <Button type="button" size="icon" variant="ghost" aria-label="Remove sector" onClick={() => updateDuty(d.id, { sectors: d.sectors.filter((_, j) => j !== i) })}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <ReportTimeInput label={scheduled ? 'Scheduled departure' : 'Off blocks'} tz={inputTz} zone={zone} echoTz={echoTz} value={s.departure_utc} onChange={(v) => updateSector(d.id, i, { departure_utc: v })} />
                                <ReportTimeInput label={scheduled ? 'Scheduled arrival' : 'On blocks'} tz={inputTz} zone={zone} echoTz={echoTz} value={s.arrival_utc} onChange={(v) => updateSector(d.id, i, { arrival_utc: v })} />
                              </div>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" onClick={() => addSector(d)}><Plus className="mr-1 h-4 w-4" />Add sector</Button>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{prospective ? 'Sleep assumptions and actual records' : 'Your actual sleep'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {prospective ? 'Review the expected sleep pattern. Future sleep stays an estimate; mark only sleep that actually happened as reported.' : 'Correct the times to when you actually fell asleep and woke up, including naps.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addSleep('nap')}><Plus className="mr-1 h-4 w-4" />Nap</Button>
                  <Button type="button" size="sm" onClick={() => addSleep('main')}><Plus className="mr-1 h-4 w-4" />Sleep</Button>
                </div>
              </div>
              {unconfirmed > 0 && (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                  <span className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{unconfirmed === 1 ? '1 sleep period is an estimate' : `${unconfirmed} sleep periods are estimates`} from your roster. {prospective ? 'They remain assumptions in the report.' : 'Edit any that differ from what happened, then confirm them.'}</span>
                  </span>
                  {!prospective && confirmKeys.length > 0 && (
                    <Button type="button" size="sm" variant="outline" onClick={confirmPastSleep}><Check className="mr-1 h-4 w-4" />These times are what happened ({confirmKeys.length})</Button>
                  )}
                </div>
              )}
              <div aria-label="Sleep before the event" className="grid gap-3 rounded-xl bg-muted/60 p-4 sm:grid-cols-3">
                {[24, 48, 72].map(h => (
                  <div key={h}>
                    <p className="text-sm text-muted-foreground">Reported sleep, {h} h before the event</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{sleeps.some(s => s.source === 'reported') ? formatHours(priorSleepHours(sleeps, eventTime, h)) : 'Not entered'}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground sm:col-span-3">Totals count reported sleep only. The report also shows estimated sleep, labelled separately.</p>
              </div>
              {visibleSleeps.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No sleep entered {activeDay ? `for ${activeDay.label}` : 'yet'}. Add each sleep and nap with the times you fell asleep and woke up.
                </p>
              )}
              {visibleSleeps.map((s, i) => {
                const futureEnd = isFuture(s.end_utc, nowMs);
                return (
                  <div key={s.key} className={cn('min-w-0 space-y-3 rounded-lg border p-4', s.source === 'estimated' && 'border-dashed')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {s.kind === 'nap' ? 'Nap' : s.kind === 'inflight_rest' ? 'In-flight rest' : 'Sleep'} {i + 1}
                        <span className="ml-2 font-normal text-muted-foreground">{fmtH(hoursBetween(s.start_utc, s.end_utc))}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {s.source === 'estimated' ? (
                          <>
                            <Badge variant="outline" className="border-dashed">Estimated</Badge>
                            {futureEnd
                              ? <span className="text-xs text-muted-foreground">Future sleep stays an estimate</span>
                              : <Button type="button" size="sm" variant="outline" onClick={() => updateSleep(s.key, { source: 'reported' })}>Mark as actual sleep</Button>}
                          </>
                        ) : <><Badge variant="outline">Reported</Badge><Button type="button" size="sm" variant="ghost" onClick={() => updateSleep(s.key, { source: 'estimated' })}>Mark as estimated</Button></>}
                        <Button type="button" size="icon" variant="ghost" aria-label="Remove sleep"
                          onClick={() => { setDiaryComplete(false); setSleeps(sleeps.filter((x) => x.key !== s.key)); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ReportTimeInput label="Fell asleep" tz={inputTz} zone={zone} echoTz={echoTz} value={s.start_utc} onChange={(v) => updateSleep(s.key, { start_utc: v })} />
                      <ReportTimeInput label="Woke up" tz={inputTz} zone={zone} echoTz={echoTz} value={s.end_utc} onChange={(v) => updateSleep(s.key, { end_utc: v })} />
                      <label className={field}><span className="text-muted-foreground">Type</span>
                        <select className={select} value={s.kind} onChange={(e) => updateSleep(s.key, { kind: e.target.value as ReportSleep['kind'] })}>
                          <option value="main">Main sleep</option><option value="nap">Nap</option><option value="inflight_rest">In-flight rest</option>
                        </select></label>
                      <label className={field}><span className="text-muted-foreground">Where</span>
                        <select className={select} value={s.location} onChange={(e) => updateSleep(s.key, { location: e.target.value as ReportSleep['location'] })}>
                          <option value="home">Home</option><option value="hotel">Hotel (layover)</option><option value="crew_rest">Crew rest / bunk</option><option value="other">Other</option>
                        </select></label>
                      <label className={field}><span className="text-muted-foreground">Quality</span>
                        <select className={select} value={s.quality ?? ''} onChange={(e) => updateSleep(s.key, { quality: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">Not rated</option>
                          <option value="1">1 – Very poor</option><option value="2">2 – Poor</option><option value="3">3 – Fair</option>
                          <option value="4">4 – Good</option><option value="5">5 – Very good</option>
                        </select></label>
                    </div>
                  </div>
                );
              })}
              {sleepIssues.map((m) => <p key={m} role="alert" data-report-error className="text-sm text-destructive">{m}</p>)}
              <label className="flex items-start gap-3 rounded-md border border-border p-4 text-sm">
                <input type="checkbox" checked={diaryComplete} onChange={e => setDiaryComplete(e.target.checked)} className="mt-1" />
                <span>{prospective ? 'I have reviewed all sleep in this scenario, including naps. Unlisted periods are modelled as awake. Estimated sleep remains an assumption.' : 'This diary includes every sleep and nap in the period. A day without an entry means I did not sleep. Without this confirmation the report shows a provisional curve only.'}</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <ReportAccountStep
              eventType={eventType} eventTime={eventTime}
              kss={kss} setKss={setKss} sp={sp} setSp={setSp}
              ratedAt={ratedAt} setRatedAt={setRatedAt} ratedAtError={attempted || ratedAt ? ratedAtError : null}
              tz={inputTz} zone={zone} homeTz={homeTz}
              factors={factors} setFactors={setFactors}
              operational={operational} setOperational={setOperational}
              narrative={narrative} setNarrative={setNarrative}
              pilot={pilot} setPilot={setPilot} pilotFromRoster={!!(results?.pilotName || results?.pilotId || results?.pilotAircraft)}
              review={review}
            />
          )}
        </CardContent>
      </Card>

      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="scroll-mb-32 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={saveDraft} onChange={e => setSaveDraft(e.target.checked)} />
        Keep a draft in this browser tab (including personal details) until you close it or sign out.
      </label>

      {/* Opaque, full-bleed action bar; the page reserves room below so nothing is hidden behind it. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_20px_-12px_rgb(0_0_0/0.25)] md:-mx-8 md:px-8">
        {(showBlockers || (error && step === 3)) && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{showBlockers ? currentBlockers[0] : 'The report could not be generated. See the message above.'}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          {!showBlockers && currentBlockers.length > 0 && step === 0 && !eventValid && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{currentBlockers[0]}</p>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => goTo(step + 1)}>
              Next<ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
              Generate report
            </Button>
          )}
        </div>
      </div>
      <div aria-hidden className="h-6" />
    </section>
  );
}
