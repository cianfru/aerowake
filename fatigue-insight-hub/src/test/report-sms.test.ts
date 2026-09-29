import { describe, expect, it } from 'vitest';
import type { FatigueReport } from '@/lib/fatigue-report-api';
import { reportToSmsSummary } from '@/lib/report-sms';

const report = {
  event: { type: 'fatigue_after_duty', time_local: '09 Sep 08:00', time_z: '07:00Z', affected_duty_label: null },
  period: { start_local: '06 Sep 08:00', end_local: '09 Sep 08:00' },
  home_timezone: 'Europe/London', pilot: {}, pilot_narrative: 'I felt sleepy; I told the duty manager.',
  self_assessment: null, contributing_factors: [], duties: [],
  sleeps: [{ start_local: '08 Sep 23:00', end_local: '09 Sep 06:00', hours: 7, kind: 'main', location: 'hotel', source: 'estimated' }],
  data_quality: { model_available: false, notes: ['Sleep diary is incomplete.'] },
  assessment: null, findings: [], limitations: ['Individual responses vary.'], report_id: 'example', report_version: 'v1.2', engine_version: 'v4', generated_at: '2026-09-09T08:00:00Z',
} as unknown as FatigueReport;

describe('portable SMS submission', () => {
  it('keeps the pilot statement verbatim, preserves estimates, and explains absent predictions', () => {
    const text = reportToSmsSummary(report);
    expect(text).toContain(report.pilot_narrative);
    expect(text).toContain('7h 00m, main, hotel; estimated.');
    expect(text).toContain('Missing evidence must not be interpreted as low fatigue.');
    expect(text).toContain('Sleep diary is incomplete.');
    expect(text).toContain('Individual responses vary.');
    expect(text).not.toContain('Self-rating recorded');
    expect(text).not.toContain('Predicted peak KSS:');
  });
  it('labels predictions and retains model provenance and reference links', () => {
    const modelled = { ...report, data_quality: { ...report.data_quality, model_available: true, prediction_basis: 'estimated_sleep' }, assessment: { kss_max: 7.25, kss_max_time_local: '09 Sep 05:00' }, scientific_basis: [{ citation: 'Source citation', url: 'https://example.org/study' }] } as FatigueReport;
    const text = reportToSmsSummary(modelled);
    expect(text).toContain('Predicted peak KSS: 7.3/9');
    expect(text).toContain('Basis: estimated sleep.');
    expect(text).toContain('Source citation https://example.org/study');
    expect(text).toContain('Report example · v1.2 · model v4');
  });
});
