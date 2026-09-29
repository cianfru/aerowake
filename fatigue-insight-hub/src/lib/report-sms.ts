import type { FatigueReport } from './fatigue-report-api';
import { formatHours } from './report-diary';

/** Copy-ready submission, without claiming an operator-specific import integration. */
export function reportToSmsSummary(r: FatigueReport): string {
  const prospective = r.event.type === 'roster_concern';
  const lines = [prospective ? 'Roster fatigue concern' : 'Fatigue report',
    `Event: ${r.event.time_local} (${r.home_timezone}); ${r.event.time_z}`,
    `Reporting period: ${r.period.start_local} to ${r.period.end_local} (${r.home_timezone})`,
    `Affected duty: ${r.event.affected_duty_label || 'Not selected'}`, ''];
  const pilot = Object.entries(r.pilot).filter(([, value]) => value).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
  if (pilot.length) lines.push(pilot.join(' · '), '');
  lines.push('Pilot statement', r.pilot_narrative || 'No statement entered.', '');
  if (r.self_assessment) {
    const self = r.self_assessment;
    lines.push(`Self-rating recorded at ${self.rated_at_local}: ${[
      self.kss != null ? `KSS ${self.kss}/9 (${self.kss_label})` : '',
      self.samn_perelli != null ? `Samn–Perelli ${self.samn_perelli}/7 (${self.samn_perelli_label})` : '',
    ].filter(Boolean).join('; ')}`, '');
  }
  if (r.contributing_factors.length) lines.push(`Reported contributing factors: ${r.contributing_factors.map(f => f.label).join(', ')}`, '');
  lines.push('Duty history (pilot-entered or roster-derived; status shown)');
  if (!r.duties.length) lines.push('No duties entered.');
  for (const duty of r.duties) lines.push(`- ${duty.report_local} to ${duty.release_local}: ${duty.label}${duty.route ? `, ${duty.route}` : ''}; ${formatHours(duty.duty_hours)}; ${duty.status.replace(/_/g, ' ')}${duty.is_affected ? '; affected duty' : ''}.`);
  lines.push('', 'Sleep history (reported and estimated are separate)');
  if (!r.sleeps.length) lines.push('No sleep entered.');
  for (const sleep of r.sleeps) lines.push(`- ${sleep.start_local} to ${sleep.end_local}: ${formatHours(sleep.hours)}, ${sleep.kind.replace(/_/g, ' ')}, ${sleep.location.replace(/_/g, ' ')}; ${sleep.source}.`);
  lines.push('', 'Model context');
  if (r.data_quality.model_available && r.assessment) {
    lines.push(`Predicted peak KSS: ${r.assessment.kss_max.toFixed(1)}/9 at ${r.assessment.kss_max_time_local}. Basis: ${(r.data_quality.prediction_basis || 'See evidence notes').replace(/_/g, ' ')}.`);
  } else lines.push('No model assessment available for the event or affected duty. Missing evidence must not be interpreted as low fatigue.');
  if (r.watch_reference) lines.push(`Personal watch reference: KSS ${r.watch_reference.kss.toFixed(1)}; a review prompt, not a regulatory or fitness limit.`);
  for (const finding of r.findings) lines.push(`- ${finding.title}: ${finding.detail}`);
  lines.push('', 'Evidence and limitations', ...r.data_quality.notes.map(note => `- ${note}`), ...r.limitations.map(note => `- ${note}`));
  if (r.scientific_basis?.length) lines.push('', 'Scientific references', ...r.scientific_basis.map(source => `${source.citation} ${source.url}`));
  lines.push('', `Report ${r.report_id} · ${r.report_version} · model ${r.engine_version} · generated ${r.generated_at}`);
  return lines.join('\n');
}
