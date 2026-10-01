import { describe, expect, it } from 'vitest';
import sample from './fixtures/fatigue-report-sample.json';
import { reportToText, type FatigueReport } from '@/lib/fatigue-report-api';
import { SUMMARY_MAX_CHARS, reportSummaryText } from '@/lib/report-export';

const report = sample as unknown as FatigueReport;

describe('operator summary', () => {
  const text = reportSummaryText(report);

  it('stays within the character budget even with a long statement', () => {
    expect(report.pilot_narrative.length + 600).toBeGreaterThan(SUMMARY_MAX_CHARS);
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS);
    expect(text).toContain('Statement: Could not fall asleep');
    expect(text).toMatch(/…/);
  });

  it('puts the key form fields first, with year, offset and Z', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('FATIGUE REPORT – Fatigue call before duty');
    expect(lines[1]).toBe('Event: Tue 08 Sep 2026 04:30 LGW (UTC+1) / 08 Sep 03:30Z');
    expect(lines[2]).toMatch(/^Duty: EZY801\/802\/803 LGW–EDI–LGW–EDI, report Tue 08 Sep 05:30/);
    expect(text).toMatch(/Self-rating: KSS 8\/9, Samn-Perelli 6\/7 at Tue 08 Sep 04:30/);
    expect(text).toMatch(/Sleep before event: 24 h 5h00 · 48 h 11h15 · 72 h 16h45 \(reported\) · last woke Tue 08 Sep 04:15 · awake 0h15 at event/);
    expect(text).toContain('Mitigations taken: Caffeine, Informed crew control / duty manager');
    expect(text).toContain('Effect on operation: Duty not operated');
    expect(text).toContain('Suggested action: Review late-to-early transitions on this pairing.');
    expect(text.indexOf('Suggested action')).toBeLessThan(text.indexOf('Statement'));
  });

  it('labels the model as an estimate and never carries the personal watch reference', () => {
    expect(text).toMatch(/Model estimate \(not a measurement\): predicted peak KSS \d\.\d \(\w+ band\)/);
    expect(text).not.toMatch(/watch/i);
    expect(reportToText(report)).not.toMatch(/watch reference/i);
  });
});

describe('full text', () => {
  const text = reportToText(report);

  it('prints each section once with record coverage and a readable generated time', () => {
    expect(text.match(/PILOT STATEMENT/g)).toHaveLength(1);
    expect(text.match(/\nFINDINGS\n/g)).toHaveLength(1);
    expect(text).toContain('Record coverage: high');
    expect(text).not.toContain('Data confidence');
    expect(text).toMatch(/Generated \d{2} \w{3} \d{4} \d{2}:\d{2}Z/);
    expect(text).toContain('Staff number: 00000');
  });

  it('lists flight numbers, sleep totals and FTL coverage', () => {
    expect(text).toContain('EZY801/802/803 LGW → EDI → LGW → EDI');
    expect(text).toMatch(/24 h 5h00 · 48 h 11h15 · 72 h 16h45/);
    expect(text).toContain('FTL CHECKS PERFORMED');
    expect(text).toMatch(/Minimum rest \(ORO\.FTL\.235\): /);
  });

  it('does not repeat identical notes', () => {
    const notes = text.split('DATA QUALITY AND LIMITATIONS')[1].split('\n').filter((l) => l.startsWith('- '));
    expect(new Set(notes).size).toBe(notes.length);
  });
});
