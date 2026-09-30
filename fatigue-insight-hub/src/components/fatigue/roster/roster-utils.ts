/**
 * Pure helpers for the Roster page (verdict, duties to watch, compact rows).
 * Kept free of React so they are easy to test.
 */
import { format } from 'date-fns';
import type { AnalysisResults, DutyAnalysis, StandbyPeriod } from '@/types/fatigue';
import {
  classifyKss,
  isElevatedRisk,
  resolveKss,
  type RiskLevel,
} from '@/lib/risk-scale';

/** Predicted peak KSS for a duty (backend max_kss, else derived from the index). */
export function dutyPeakKss(duty: DutyAnalysis): number | null {
  return resolveKss(duty.maxKss, duty.minPerformance, duty.modelVersion);
}

/** Risk level of a duty (backend risk_level, else classified from peak KSS). */
export function dutyRiskLevel(duty: DutyAnalysis): RiskLevel {
  return classifyKss(dutyPeakKss(duty));
}

/** "DOH → NJF → DOH"; falls back to the duty type for non-flying duties. */
export function dutyRoute(duty: DutyAnalysis): string {
  const segs = (duty.flightSegments ?? []).filter((s) => s.activityCode !== 'IR');
  if (segs.length) {
    const stops: string[] = [segs[0].departure];
    for (const s of segs) {
      if (stops[stops.length - 1] !== s.departure) stops.push(s.departure);
      stops.push(s.arrival);
    }
    return stops.filter(Boolean).join(' → ');
  }
  switch (duty.dutyType) {
    case 'simulator': return duty.trainingCode ? `Simulator (${duty.trainingCode})` : 'Simulator';
    case 'ground_training': return duty.trainingCode ? `Ground training (${duty.trainingCode})` : 'Ground training';
    case 'airport_standby': return 'Airport standby';
    default: return 'Duty';
  }
}

/** "06:10–14:35" in home-base time, or '' when unknown. */
export function dutyTimes(duty: DutyAnalysis): string {
  const a = duty.reportTimeLocal;
  const b = duty.releaseTimeLocal;
  if (!a || !b) return '';
  return `${a}–${b}`;
}

/** "Tue 8 Sep" */
export function dutyDateLabel(duty: DutyAnalysis): string {
  try {
    return format(duty.date, 'EEE d MMM');
  } catch {
    return duty.dateString ?? '';
  }
}

/**
 * Duties the model thinks need special attention, worst first.
 *
 * Recompute from canonical peak KSS so saved landing-risk lists cannot hide a demanding duty.
 */
export function selectDutiesToWatch(results: Pick<AnalysisResults, 'duties' | 'dutiesToWatch'>): DutyAnalysis[] {
  const duties = results.duties ?? [];
  return duties
    .filter((d) => isElevatedRisk(dutyRiskLevel(d)))
    .sort((a, b) => (dutyPeakKss(b) ?? 0) - (dutyPeakKss(a) ?? 0));
}

export type RosterRow =
  | { kind: 'duty'; key: string; sortKey: string; duty: DutyAnalysis }
  | { kind: 'standby'; key: string; sortKey: string; standby: StandbyPeriod };

function dutySortKey(d: DutyAnalysis): string {
  if (d.reportTimeUtc && /^\d{4}-\d{2}-\d{2}T/.test(d.reportTimeUtc)) return d.reportTimeUtc;
  return `${d.dateString ?? format(d.date, 'yyyy-MM-dd')}T${d.reportTimeLocal ?? '00:00'}`;
}

/** Duties + standby periods in chronological order (one compact row each). */
export function buildRosterRows(
  duties: DutyAnalysis[],
  standby: StandbyPeriod[] | undefined,
): RosterRow[] {
  const rows: RosterRow[] = duties.map((duty, i) => ({
    kind: 'duty',
    key: duty.dutyId ?? `duty-${i}`,
    sortKey: dutySortKey(duty),
    duty,
  }));
  // Airport standby may also be reported as a duty — don't list it twice.
  const dutyStarts = new Set(
    duties.filter((d) => d.dutyType === 'airport_standby').map((d) => d.reportTimeUtc?.slice(0, 16)),
  );
  for (const s of standby ?? []) {
    if (s.type === 'airport_standby' && dutyStarts.has(s.startUtc.slice(0, 16))) continue;
    rows.push({ kind: 'standby', key: `sb-${s.id}`, sortKey: s.startUtc, standby: s });
  }
  return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function standbyLabel(s: StandbyPeriod): string {
  const kind = s.type === 'airport_standby' ? 'Airport standby' : 'Home standby';
  const times = s.startHome && s.endHome ? ` ${s.startHome}–${s.endHome}` : '';
  return `${kind}${times}`;
}

/** "38/60h" */
export function formatLimit(value: number, limit: number): string {
  return `${Math.round(value)}/${Math.round(limit)}h`;
}

export interface WatchGroup {
  level: RiskLevel;
  duties: DutyAnalysis[];
  /** Reasons every duty in the group shares (stated once in the header). */
  shared: Set<string>;
}

/**
 * Duties to watch grouped by band, most demanding band first, keeping the
 * worst-first order inside each group. Reasons common to a whole group of two
 * or more are lifted into the group so cards only say what sets them apart.
 */
export function groupDutiesToWatch(watch: DutyAnalysis[]): WatchGroup[] {
  const groups: WatchGroup[] = [];
  for (const duty of watch) {
    const level = dutyRiskLevel(duty);
    let group = groups.find((g) => g.level === level);
    if (!group) { group = { level, duties: [], shared: new Set() }; groups.push(group); }
    group.duties.push(duty);
  }
  for (const g of groups) {
    if (g.duties.length < 2) continue;
    const [head, ...rest] = g.duties.map((d) => new Set(d.riskReasons ?? []));
    for (const r of head) if (rest.every((s) => s.has(r))) g.shared.add(r);
  }
  return groups;
}
