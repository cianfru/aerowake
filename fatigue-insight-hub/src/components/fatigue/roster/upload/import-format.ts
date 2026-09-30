/**
 * Plain-language formatting for the roster import summary.
 * Pure helpers: no React, easy to test.
 */
import { format, parseISO } from 'date-fns';
import type { BaseSource, RosterPreview, RosterPreviewDuty } from '@/lib/api-client';

export const MAX_ROSTER_BYTES = 10 * 1024 * 1024;
export const ROSTER_EXTENSIONS = ['.pdf', '.csv'] as const;
export const IATA_RE = /^[A-Z]{3}$/;
/**
 * Synthetic CSV template (two duties at a London Gatwick base). Served as a
 * data URL: roster CSVs are kept out of the repository and static hosting.
 */
export const TEMPLATE_CSV = [
  'Date,Flight,Departure,Arrival,STD,STA,Report,Release',
  '2026-10-05,XX101,LGW,AMS,07:00,09:15,06:00,11:00',
  '2026-10-05,XX102,AMS,LGW,10:00,10:25,06:00,11:00',
  '2026-10-07,XX201,LGW,TFS,21:30,01:45,20:30,02:30',
  '',
].join('\n');
export const TEMPLATE_FILENAME = 'aerowake-roster-template.csv';
export const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`;

export type RosterFileKind = 'PDF' | 'CSV';

/** Client-side check before any upload: extension, emptiness and the 10 MB server limit. */
export function checkRosterFile(file: Pick<File, 'name' | 'size'>): { kind: RosterFileKind } | { error: string } {
  const name = file.name.toLowerCase();
  const kind: RosterFileKind | null = name.endsWith('.pdf') ? 'PDF' : name.endsWith('.csv') ? 'CSV' : null;
  if (!kind) return { error: 'Aerowake reads PDF or CSV rosters. Choose a .pdf or .csv file.' };
  if (file.size === 0) return { error: 'This file is empty. Choose your exported roster.' };
  if (file.size > MAX_ROSTER_BYTES) return { error: 'This file is larger than 10 MB. Upload one roster month at a time.' };
  return { kind };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** '2026-10' → 'October 2026'. */
export function monthInWords(month: string) {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
}

/** Decimal hours as h:mm (37.25 → '37:15'). */
export function hhmm(hours: number) {
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 ? '-' : ''}${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** '+03:00' → 'UTC+3', '+05:30' → 'UTC+5:30', '+00:00' → 'UTC+0'. */
export function utcLabel(offset: string) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return `UTC${offset}`;
  const [, sign, h, m] = match;
  return `UTC${sign}${Number(h)}${m === '00' ? '' : `:${m}`}`;
}

export function offsetsLabel(offsets: string[] | undefined) {
  if (!offsets?.length) return '';
  if (offsets.length === 1) return utcLabel(offsets[0]);
  return `${offsets.map(utcLabel).join(', then ')} (clock change)`;
}

/**
 * Time-zone name in British English: 'Arabian Standard Time', or the generic
 * 'United Kingdom Time' when the month spans a clock change.
 */
export function zoneName(timeZone: string, at: Date = new Date(), generic = false) {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: generic ? 'longGeneric' : 'long' })
      .formatToParts(at).find(p => p.type === 'timeZoneName');
    return part?.value && !/^GMT[+-]/.test(part.value) ? part.value : null;
  } catch {
    return null;
  }
}

export function countryName(code: string | null | undefined) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) ?? null;
  } catch {
    return null;
  }
}

const FORMAT_LABELS: Record<string, string> = {
  crewlink: 'CrewLink PDF',
  easyjet: 'easyJet PDF',
  csv: 'CSV roster',
  pdf: 'PDF roster',
};

export function formatLabel(rosterFormat: string | undefined) {
  return (rosterFormat && FORMAT_LABELS[rosterFormat]) || 'Roster';
}

const CONVENTIONS: Record<string, string> = {
  zulu: 'Roster times are in UTC',
  local: 'Roster times are local at each airport',
  homebase: 'Roster times are in home-base time',
};

export function conventionLabel(convention: string) {
  return CONVENTIONS[convention]
    ?? 'Report and release in home-base time; flight times local at each airport';
}

export const BASE_SOURCE_LABELS: Record<BaseSource, string> = {
  roster_header: 'From roster header',
  duty_pattern: 'Inferred from your duties',
  entered: 'Entered by you',
};

export function warnings(preview: RosterPreview) {
  if (preview.checks) return preview.checks.filter(c => c.severity === 'warning');
  return preview.warnings.map(message => ({ code: 'warning', severity: 'warning' as const, message }));
}

export function notes(preview: RosterPreview) {
  return (preview.checks ?? []).filter(c => c.severity === 'info');
}

/** Checkbox only for flagged imports; the backend flag wins, with a fallback for older responses. */
export function needsConfirmation(preview: RosterPreview) {
  if (typeof preview.needs_confirmation === 'boolean') return preview.needs_confirmation;
  return !!preview.base_conflict || preview.base_source === 'duty_pattern' || preview.block_total_matches_source === false;
}

/** Duty times in one zone: 'Mon 5 Oct', '17:15', '00:45', '+1' when release is the next day. */
export function dutyTimes(duty: Pick<RosterPreviewDuty, 'report_utc' | 'release_utc'>, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' });
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const report = new Date(duty.report_utc);
  const release = new Date(duty.release_utc);
  const days = Math.round((Date.parse(dateKey.format(release)) - Date.parse(dateKey.format(report))) / 86_400_000);
  return {
    day: day.format(report).replace(',', ''),
    report: time.format(report),
    release: time.format(release),
    dayOffset: days > 0 ? `+${days}` : '',
  };
}
