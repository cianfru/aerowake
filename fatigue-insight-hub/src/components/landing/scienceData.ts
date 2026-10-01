import { RISK_LEVEL_LABELS } from '@/lib/risk-scale';
import { formatKssValue, kssBand } from './landingKss';

/**
 * One overnight duty, two ways to prepare: predicted KSS from the published
 * Three Process Model equations (Ingre et al. 2014, model 5c) as implemented
 * in the Aerowake engine (fatigue-tool/core/published_tpm.py).
 *
 * Scenario (home-base local time, UTC+3): usual sleep 23:00–07:00 on the
 * preceding nights, awake from 07:00, duty 01:00–09:00 the next morning.
 * "Nap" adds a 15:00–17:00 sleep. Values every 15 minutes from 08:00 on day 1
 * to 10:00 on day 2, null while asleep and for the first hour after waking,
 * because sleep inertia is not part of the model. Group-average pilot; engine
 * outputs rounded to two decimals, never edited by hand: regenerate with
 * `python scripts/landing_data.py` from fatigue-tool, where
 * tests/test_landing_data.py checks these literals against the model.
 */
export const SCIENCE_SCENARIO = {
  /** Clock hour of the first sample. */
  startHour: 8,
  stepHours: 0.25,
  /** Spans in hours from the first sample. */
  duty: [17, 25] as [number, number],
  nap: [7, 9] as [number, number],
  /** WOCL 02:00–05:59 on day 2. */
  wocl: [18, 22] as [number, number],
  noNap: [4.28, 4.27, 4.26, 4.25, 4.25, 4.24, 4.24, 4.23, 4.23, 4.22, 4.22, 4.21, 4.21, 4.2, 4.2, 4.19, 4.18, 4.17, 4.16, 4.15, 4.14, 4.13, 4.11, 4.09, 4.08, 4.06, 4.04, 4.02, 4.01, 3.99, 3.98, 3.96, 3.95, 3.94, 3.94, 3.94, 3.94, 3.95, 3.97, 3.99, 4.01, 4.05, 4.09, 4.14, 4.19, 4.26, 4.33, 4.4, 4.49, 4.58, 4.68, 4.78, 4.89, 5.01, 5.13, 5.25, 5.38, 5.51, 5.64, 5.77, 5.9, 6.03, 6.16, 6.29, 6.41, 6.53, 6.65, 6.76, 6.86, 6.96, 7.05, 7.13, 7.2, 7.27, 7.33, 7.38, 7.42, 7.46, 7.49, 7.51, 7.52, 7.53, 7.53, 7.52, 7.51, 7.5, 7.48, 7.46, 7.43, 7.4, 7.37, 7.34, 7.31, 7.28, 7.24, 7.21, 7.17, 7.14, 7.11, 7.08, 7.04, 7.01, 6.98, 6.95, 6.93] as (number | null)[],
  nap2h: [4.28, 4.27, 4.26, 4.25, 4.25, 4.24, 4.24, 4.23, 4.23, 4.22, 4.22, 4.21, 4.21, 4.2, 4.2, 4.19, 4.18, 4.17, 4.16, 4.15, 4.14, 4.13, 4.11, 4.09, 4.08, 4.06, 4.04, 4.02, null, null, null, null, null, null, null, null, null, null, null, null, 3.06, 3.1, 3.15, 3.21, 3.27, 3.34, 3.42, 3.51, 3.6, 3.7, 3.8, 3.92, 4.03, 4.16, 4.28, 4.42, 4.55, 4.69, 4.83, 4.96, 5.1, 5.24, 5.38, 5.51, 5.64, 5.77, 5.89, 6, 6.11, 6.22, 6.31, 6.4, 6.48, 6.56, 6.62, 6.68, 6.73, 6.77, 6.8, 6.83, 6.85, 6.86, 6.87, 6.87, 6.87, 6.86, 6.84, 6.83, 6.81, 6.78, 6.76, 6.73, 6.71, 6.68, 6.65, 6.62, 6.59, 6.56, 6.53, 6.51, 6.48, 6.46, 6.43, 6.41, 6.38] as (number | null)[],
};

export interface Citation {
  text: string;
  href?: string;
}

export const SCIENCE_CITATIONS: Citation[] = [
  { text: 'Borbély AA (1982). A two process model of sleep regulation. Human Neurobiology 1(3): 195–204.' },
  { text: 'Åkerstedt T, Gillberg M (1990). Subjective and objective sleepiness in the active individual. International Journal of Neuroscience 52(1–2): 29–37.' },
  { text: 'Åkerstedt T, Folkard S (1997). The three-process model of alertness and its extension to performance, sleep latency, and sleep length. Chronobiology International 14(2): 115–123.' },
  { text: 'Ingre M, Van Leeuwen W, Klemets T, et al. (2014). Validating and extending the three process model of alertness in airline operations. PLoS ONE 9(10): e108679.', href: 'https://doi.org/10.1371/journal.pone.0108679' },
];

export const N = SCIENCE_SCENARIO.noNap.length;
export const HOURS = (N - 1) * SCIENCE_SCENARIO.stepHours;
export const SERIES = [
  { key: 'noNap', label: 'No nap, awake from 07:00', color: '#94a3b0', values: SCIENCE_SCENARIO.noNap },
  { key: 'nap', label: 'Two-hour nap, 15:00–17:00', color: '#0e6f86', values: SCIENCE_SCENARIO.nap2h },
] as const;
export const BAND_LINES = [
  { kss: 5.5, label: 'Moderate' },
  { kss: 6.5, label: 'High' },
  { kss: 7.5, label: 'Critical' },
  { kss: 8.5, label: 'Extreme' },
];

/** Clock time of an hour offset from the first sample, e.g. 20.25 → '04:15'. */
export function clockAt(hours: number): string {
  const minutes = Math.round((SCIENCE_SCENARIO.startHour + hours) * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Highest value (first occurrence) inside the duty span. */
export function dutyPeak(values: readonly (number | null)[]): { index: number; kss: number } {
  const [from, to] = SCIENCE_SCENARIO.duty.map((h) => Math.round(h / SCIENCE_SCENARIO.stepHours));
  let best = { index: from, kss: -Infinity };
  for (let i = from; i <= to; i++) {
    const v = values[i];
    if (v != null && v > best.kss) best = { index: i, kss: v };
  }
  return best;
}

export const SCIENCE_PEAKS = SERIES.map((s) => ({ key: s.key, label: s.label, ...dutyPeak(s.values) }));

/** Sentence summarising both peaks with their bands, derived from the data. */
export function sciencePeakSummary(): string {
  const [none, nap] = SCIENCE_PEAKS;
  const band = (k: number) => RISK_LEVEL_LABELS[kssBand(k)];
  return `Without a nap, predicted KSS peaks at ${formatKssValue(none.kss)} (${band(none.kss)}) around ${clockAt(none.index * SCIENCE_SCENARIO.stepHours)}. With a two-hour afternoon nap, the same duty peaks at ${formatKssValue(nap.kss)} (${band(nap.kss)}).`;
}
