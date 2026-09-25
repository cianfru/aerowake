/** Minimal backend AnalysisResponse fixture with the aerowake-4.0-kss roster fields. */
import type { AnalysisResult, Duty } from '@/lib/api-client';

function duty(id: string, date: string, report: string, release: string, risk: Duty['risk_level'], maxKss: number,
  segs: Array<[string, string, string, string]>, reasons?: string[]): Duty {
  return {
    duty_id: id,
    date,
    report_time_utc: `${date}T${report}:00Z`,
    release_time_utc: `${date}T${release}:00Z`,
    report_time_local: report,
    release_time_local: release,
    duty_hours: 8,
    sectors: segs.length,
    segments: segs.map(([fn, dep, arr, t]) => ({
      flight_number: fn, departure: dep, arrival: arr,
      departure_time: `${date}T${t}:00Z`, arrival_time: `${date}T${t}:00Z`,
      departure_time_local: t, arrival_time_local: t, block_hours: 2,
      departure_time_home_tz: t, arrival_time_home_tz: t,
      departure_time_airport_local: t, arrival_time_airport_local: t,
      departure_timezone: 'Europe/London', arrival_timezone: 'Europe/London',
      departure_utc_offset: 0, arrival_utc_offset: 0,
    })),
    min_performance: 110 - 10 * maxKss,
    avg_performance: 70,
    landing_performance: 65,
    max_kss: maxKss,
    sleep_debt: 1,
    wocl_hours: 0,
    prior_sleep: 7,
    risk_level: risk,
    is_reportable: false,
    pinch_events: 0,
    risk_reasons: reasons,
  } as unknown as Duty;
}

export const rosterFixture: AnalysisResult = {
  analysis_id: 'a1',
  roster_id: 'r1',
  pilot_id: 'P1',
  pilot_name: 'Test Pilot',
  pilot_base: 'LGW',
  pilot_aircraft: 'A320',
  home_base_timezone: 'Europe/London',
  month: '2026-09',
  total_duties: 4,
  total_sectors: 7,
  total_duty_hours: 32,
  total_block_hours: 14,
  high_risk_duties: 1,
  critical_risk_duties: 1,
  total_pinch_events: 0,
  avg_sleep_per_night: 7,
  max_sleep_debt: 2,
  worst_duty_id: 'D3',
  worst_performance: 30,
  duties: [
    duty('D1', '2026-09-02', '06:00', '14:00', 'low', 3.1, [['EZY1', 'LGW', 'NCE', '07:00'], ['EZY2', 'NCE', 'LGW', '10:30']]),
    duty('D2', '2026-09-05', '13:00', '21:00', 'moderate', 5.8, [['EZY3', 'LGW', 'AMS', '14:00'], ['EZY4', 'AMS', 'LGW', '17:00']]),
    duty('D3', '2026-09-09', '21:00', '05:00', 'critical', 8.0, [['EZY5', 'LGW', 'TFS', '22:00']], [
      'Lands 02:40 home-base time, during the body-clock low',
      'About 18h awake by landing',
      'Short rest before report (10h30)',
    ]),
    duty('D4', '2026-09-12', '05:00', '13:00', 'high', 6.9, [['EZY7', 'LGW', 'GVA', '06:00'], ['EZY8', 'GVA', 'LGW', '09:00']], [
      'Early report after a late finish',
    ]),
  ],
  duties_to_watch: ['D3', 'D4'],
  easa_findings: [
    {
      rule: 'rest_between_duties', reference: 'ORO.FTL.235(a)', severity: 'warning',
      title: 'Rest shorter than the minimum', detail: 'Rest before 12 Sep was 10h30 (minimum 12h).',
      window_start_utc: '2026-09-11T18:30:00Z', window_end_utc: '2026-09-12T05:00:00Z', value: 10.5, limit: 12,
    },
    {
      rule: 'fdp_info', reference: 'ORO.FTL.205', severity: 'info',
      title: 'FDP tables applied', detail: 'Acclimatised table used.', value: null, limit: null,
    },
  ],
  easa_summary: {
    duty_7d_max: 38.2, duty_14d_max: 71, duty_28d_max: 128, block_28d_max: 62,
    limits: { duty_7d: 60, duty_14d: 110, duty_28d: 190, block_28d: 100 },
  },
  standby_periods: [
    {
      id: 'SB1', type: 'home_standby', code: 'HSBY',
      start_utc: '2026-09-07T14:00:00Z', end_utc: '2026-09-07T21:00:00Z',
      start_home: '15:00', end_home: '22:00', date: '2026-09-07', counted_duty_hours: 1.75,
    },
  ],
};
