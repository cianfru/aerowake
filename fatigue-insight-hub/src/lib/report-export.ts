/**
 * Operator-ready exports of a generated fatigue report.
 *
 * `reportSummaryText` is the short text a pilot pastes into the operator's
 * safety report form (ICAO Doc 9966 / AMC-GM ORO.FTL.120 items first). The
 * full text lives in `reportToText`; charts travel in the PDF.
 */
import type { FatigueReport } from './fatigue-report-api';
import { formatDuration, formatUtcOffset } from './report-time';

export const SUMMARY_MAX_CHARS = 1200;

const EVENT_TITLE: Record<string, string> = {
  roster_concern: 'Roster concern (planned duty)',
  fatigue_call_before_duty: 'Fatigue call before duty',
  fatigue_during_duty: 'Fatigue during duty',
  fatigue_after_duty: 'Fatigue after duty',
};

const STATUS_WORDS: Record<string, string> = {
  operated: 'operated',
  planned: 'planned',
  cancelled_fatigue: 'not operated (fatigue)',
  not_operated: 'not operated (other reason)',
};

const BASIS_WORDS: Record<string, string> = {
  reported: 'reported', estimated: 'estimated from roster', mixed: 'reported and estimated', none: 'none entered',
};

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '')}…`;
}

/** The report's affected duty row, if any. */
function affectedDuty(r: FatigueReport) {
  return r.duties?.find((d) => d.id === r.event.affected_duty_id) ?? null;
}

/**
 * Short summary, at most SUMMARY_MAX_CHARS characters, fixed field order:
 * event time (local with offset, and Z), duty and flight numbers, reporter,
 * self-rating, sleep 24/48/72 h, time awake, contributing factors,
 * mitigations, effect, suggested action, statement, model context, id.
 * The personal watch reference is never included.
 */
export function reportSummaryText(r: FatigueReport, max = SUMMARY_MAX_CHARS): string {
  const base = r.home_base ?? '';
  const offset = r.event.utc_offset ?? formatUtcOffset(r.home_timezone, r.event.time_utc);
  const head: string[] = [];
  head.push(`FATIGUE REPORT – ${EVENT_TITLE[r.event.type] ?? 'Fatigue report'}`);
  head.push(`Event: ${r.event.time_local_long ?? r.event.time_local} ${base ? `${base} ` : ''}(${offset}) / ${r.event.time_z}`);
  const d = affectedDuty(r);
  if (d) {
    const flights = d.flights_label || (d.flights?.join('/') ?? '');
    head.push(`Duty: ${[flights, d.route.replace(/ → /g, '–')].filter(Boolean).join(' ')}, report ${d.report_local} (${d.report_z}), ${STATUS_WORDS[d.status] ?? d.status}`);
  }
  const op = r.operational;
  const reporter = [
    r.pilot?.rank, op?.crew_position_label && op.crew_position_label !== r.pilot?.rank ? op.crew_position_label : null,
    op?.pilot_role_label, r.pilot?.fleet, base ? `base ${base}` : null,
    r.pilot?.staff_number ? `staff ${r.pilot.staff_number}` : null, r.pilot?.operator,
  ].filter(Boolean);
  if (reporter.length) head.push(`Reporter: ${reporter.join(', ')}`);
  const sa = r.self_assessment;
  if (sa && (sa.kss != null || sa.samn_perelli != null)) {
    const parts = [
      sa.kss != null ? `KSS ${sa.kss}/9` : '',
      sa.samn_perelli != null ? `Samn-Perelli ${sa.samn_perelli}/7` : '',
    ].filter(Boolean).join(', ');
    head.push(`Self-rating: ${parts} at ${sa.rated_at_local}${sa.rated_at_z ? ` (${sa.rated_at_z})` : ''}`);
  }
  const ss = r.sleep_summary;
  if (ss) {
    const woke = ss.last_wake_local ? ` · last woke ${ss.last_wake_local}` : '';
    const awake = ss.hours_awake_at_event != null ? ` · awake ${formatDuration(ss.hours_awake_at_event)} at event` : '';
    head.push(`Sleep before event: 24 h ${formatDuration(ss.sleep_24h)} · 48 h ${formatDuration(ss.sleep_48h)} · 72 h ${formatDuration(ss.sleep_72h)} (${BASIS_WORDS[ss.basis] ?? ss.basis})${woke}${awake}`);
  }
  if (op?.phase_of_flight_label) head.push(`Phase of flight: ${op.phase_of_flight_label}`);
  if (r.contributing_factors?.length) head.push(`Contributing factors: ${r.contributing_factors.map((f) => f.label).join(', ')}`);
  if (op?.mitigations?.length) head.push(`Mitigations taken: ${op.mitigations.map((m) => m.label).join(', ')}`);
  if (op?.effect_on_operation_label) head.push(`Effect on operation: ${op.effect_on_operation_label}`);

  const tail: string[] = [];
  if (r.data_quality?.model_available && r.assessment) {
    tail.push(`Model estimate (not a measurement): predicted peak KSS ${r.assessment.kss_max.toFixed(1)} (${r.assessment.risk_level} band) at ${r.assessment.kss_max_time_local}`);
  } else {
    tail.push('Model estimate: not produced (sleep history not confirmed complete)');
  }
  tail.push(`Report ${r.report_id?.slice(0, 8) ?? ''} · ${r.report_version} · full report and charts in the PDF`);

  // Flexible fields share whatever room is left, suggested action first.
  const fixed = [...head, ...tail].join('\n').length;
  let room = max - fixed;
  const flexible: string[] = [];
  const add = (label: string, text: string | undefined | null) => {
    if (!text?.trim() || room <= label.length + 12) return;
    const line = `${label}${clip(text, room - label.length - 1)}`;
    flexible.push(line);
    room -= line.length + 1;
  };
  add('Suggested action: ', op?.suggested_action);
  add('Statement: ', r.pilot_narrative);

  let lines = [...head, ...flexible, ...tail];
  // Hard cap: drop optional lines from the end of the head block if a field is unexpectedly long.
  while (lines.join('\n').length > max && head.length > 2) {
    head.pop();
    lines = [...head, ...flexible, ...tail];
  }
  return lines.join('\n').slice(0, max);
}
