import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import sample from './fixtures/fatigue-report-sample.json';
import type { FatigueReport } from '@/lib/fatigue-report-api';
import type { AnalysisResults } from '@/types/fatigue';
import { estimatedSleepsFromAnalysis } from '@/lib/fatigue-report-api';
import {
  actogramCaption, buildActogram, buildKssSeries, chartWindow, kssBand, kssCaption, localTicks,
} from '@/components/fatigue/fatigue-report/charts/chart-model';
import { PRINT_PALETTE } from '@/components/fatigue/fatigue-report/charts/chart-palette';
import { ReportActogram } from '@/components/fatigue/fatigue-report/charts/ReportActogram';
import { ReportKssChart } from '@/components/fatigue/fatigue-report/charts/ReportKssChart';
import { FatigueReportView } from '@/components/fatigue/fatigue-report/FatigueReportView';

const report = sample as unknown as FatigueReport;

describe('chart model', () => {
  it('covers 72 h before the event, one row per home-base day', () => {
    const w = chartWindow(report);
    expect(w.end - w.start).toBeGreaterThanOrEqual(72 * 3600e3);
    const { rows } = buildActogram(report);
    expect(rows.map((r) => r.day)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08']);
    const eventRow = rows.find((r) => r.event != null)!;
    expect(eventRow.day).toBe('2026-09-08');
    expect(eventRow.event).toBeCloseTo(4.5, 5); // 04:30 London local
    expect(rows[2].duties.some((d) => d.label?.startsWith('EZY1'))).toBe(true);
  });

  it('splits overnight sleep at local midnight and totals it per day', () => {
    const { rows } = buildActogram(report);
    const sep6 = rows.find((r) => r.day === '2026-09-06')!;
    // 23:00–04:45 then 22:30–07:00: 4h45 + 1h30 on the 6th
    expect(sep6.sleepHours).toBeCloseTo(6.25, 2);
    expect(sep6.sleeps.every((s) => s.x0 >= 0 && s.x1 <= 24)).toBe(true);
  });

  it('labels the assessed peak and stops the curve at the assessed point', () => {
    const s = buildKssSeries(report)!;
    expect(s.provisional).toBe(false);
    expect(s.peak!.kss).toBe(report.assessment!.kss_max);
    const last = Math.max(...s.median.flat().map((p) => p.t));
    expect(last).toBeLessThanOrEqual(chartWindow(report).end);
  });

  it('falls back to the provisional curve when the diary is not confirmed', () => {
    const provisional = { ...report, timeline: [], provisional_timeline: report.timeline, assessment: null } as FatigueReport;
    const s = buildKssSeries(provisional)!;
    expect(s.provisional).toBe(true);
    expect(kssCaption(provisional)).toMatch(/^Provisional illustration/);
  });

  it('classifies on the displayed value, lower bound inclusive', () => {
    expect(kssBand(5.44)).toBe('low');
    expect(kssBand(5.45)).toBe('moderate');
    expect(kssBand(6.5)).toBe('high');
    expect(kssBand(7.46)).toBe('critical');
    expect(kssBand(8.5)).toBe('extreme');
  });

  it('puts major ticks on local midnight', () => {
    const ticks = localTicks({ start: Date.parse('2026-09-05T12:00:00Z'), end: Date.parse('2026-09-07T12:00:00Z') }, 'Europe/London');
    expect(ticks.major.map((t) => new Date(t.t).toISOString())).toEqual(['2026-09-05T23:00:00.000Z', '2026-09-06T23:00:00.000Z']);
  });

  it('describes the figure in words', () => {
    expect(actogramCaption(report)).toMatch(/Sleep in 72 h: 16h45 \(reported 16h45, estimated 0h00\)/);
  });
});

describe('print-safe SVG charts', () => {
  it('render as fixed-viewBox SVG with patterns, legend and no personal watch line', () => {
    for (const Chart of [ReportActogram, ReportKssChart]) {
      const svg = renderToStaticMarkup(<Chart report={report} width={700} palette={PRINT_PALETTE} idPrefix="t" />);
      expect(svg).toMatch(/^<svg viewBox="0 0 700 [\d.]+" width="100%"/);
      expect(svg).toContain('id="t-est"');
      expect(svg).not.toMatch(/watch/i);
      expect(svg).not.toContain('var(--');
    }
    const kss = renderToStaticMarkup(<ReportKssChart report={report} width={700} palette={PRINT_PALETTE} idPrefix="t" />);
    expect(kss).toContain('Critical 7.5');
    expect(kss).toContain('Self 8');
  });
});

describe('report view', () => {
  it('shows base, year, labelled pilot fields and both figures, without the watch reference', () => {
    render(<FatigueReportView report={report} onEdit={() => undefined} />);
    expect(screen.getByText('Tue 08 Sep 2026 04:30 LGW (UTC+1) / 03:30Z')).toBeInTheDocument();
    expect(screen.getByText('Staff number')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /Figure 1/ })).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /Figure 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy summary' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Personal watch reference: KSS/);
    expect(screen.getByLabelText('Reporter confirmation')).toBeInTheDocument();
  });
});

describe('pre-filled sleep location', () => {
  const results = {
    pilotBase: 'DOH',
    duties: [
      {
        dutyId: 'OUT', reportTimeUtc: '2026-10-27T15:00:00Z', releaseTimeUtc: '2026-10-27T21:15:00Z',
        flightSegments: [{ flightNumber: '506', departure: 'DOH', arrival: 'TRV', departureTimeUtc: '16:15Z', arrivalTimeUtc: '20:45Z' }],
        sleepEstimate: { sleepBlocks: [{ sleepStartUtc: '2026-10-26T20:00:00Z', sleepEndUtc: '2026-10-27T04:00:00Z', sleepType: 'main' }] },
      },
      {
        dutyId: 'BACK', reportTimeUtc: '2026-10-28T21:15:00Z', releaseTimeUtc: '2026-10-29T03:35:00Z',
        flightSegments: [{ flightNumber: '507', departure: 'TRV', arrival: 'DOH', departureTimeUtc: '22:15Z', arrivalTimeUtc: '03:05Z' }],
        // Layover sleep in TRV and a nap there; the API does not pass an environment.
        sleepEstimate: { sleepBlocks: [
          { sleepStartUtc: '2026-10-27T22:45:00Z', sleepEndUtc: '2026-10-28T06:37:00Z', sleepType: 'main' },
          { sleepStartUtc: '2026-10-28T15:00:00Z', sleepEndUtc: '2026-10-28T17:00:00Z', sleepType: 'nap' },
        ] },
      },
    ],
    restDaysSleep: [{ sleepBlocks: [{ sleepStartIso: '2026-10-29T06:05:00Z', sleepEndIso: '2026-10-29T09:35:00Z', sleepType: 'nap', environment: 'home' }] }],
  } as unknown as AnalysisResults;

  it('uses home at base and hotel on a layover, never a silent "other"', () => {
    const sleeps = estimatedSleepsFromAnalysis(results, '2026-10-27T00:00:00Z', '2026-10-30T00:00:00Z');
    expect(sleeps.map((s) => s.location)).toEqual(['home', 'hotel', 'hotel', 'home']);
    expect(sleeps.every((s) => s.source === 'estimated')).toBe(true);
  });

  it('prefers the per-block environment when the API provides it', () => {
    const withEnv = structuredClone(results) as unknown as { duties: { sleepEstimate: { sleepBlocks: Record<string, unknown>[] } }[] };
    withEnv.duties[1].sleepEstimate.sleepBlocks[0].environment = 'airport_hotel';
    withEnv.duties[0].sleepEstimate.sleepBlocks[0].environment = 'crew_rest';
    const sleeps = estimatedSleepsFromAnalysis(withEnv as unknown as AnalysisResults, '2026-10-27T00:00:00Z', '2026-10-30T00:00:00Z');
    expect(sleeps[0].location).toBe('crew_rest');
    expect(sleeps[1].location).toBe('hotel');
  });
});
