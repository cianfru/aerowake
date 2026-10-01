import type { FatigueReport } from '@/lib/fatigue-report-api';
import { formatClock, formatUtcOffset } from '@/lib/report-time';
import { KSS_BANDS, buildKssSeries, dayLabel, localTicks, modelAtRating } from './chart-model';
import type { ChartPalette } from './chart-palette';
import { ChartPatterns } from './chart-parts';
import { legendRow, type LegendItem } from './chart-legend';

/**
 * Predicted KSS (model estimate, average and 90th-percentile pilot) with the
 * canonical band thresholds, sleep and duty strips under the axis, the event
 * line and the pilot's own rating. Returns null when no curve exists.
 */
export function ReportKssChart({ report, width, palette, idPrefix }: {
  report: FatigueReport; width: number; palette: ChartPalette; idPrefix: string;
}) {
  const series = buildKssSeries(report);
  if (!series) return null;
  const p = palette;
  const tz = report.home_timezone;
  const narrow = width < 560;
  const fs = 11;
  const left = 30, right = narrow ? 70 : 82;
  const x0 = left, x1 = width - right;
  const top = 22, plotH = narrow ? 170 : 190;
  const yBottom = top + plotH;
  const { start, end } = series.domain;
  const tx = (t: number) => x0 + ((t - start) / Math.max(1, end - start)) * (x1 - x0);
  const ky = (k: number) => top + ((9 - Math.min(9, Math.max(1, k))) / 8) * plotH;
  const stripY = yBottom + 8, stripH = 9, dutyStripY = stripY + stripH + 4;
  const axisY = dutyStripY + stripH + 14;
  const ticks = localTicks(series.domain, tz);
  const pat = (n: string) => `url(#${idPrefix}-${n})`;
  const clipT = (t: number) => Math.min(end, Math.max(start, t));
  const path = (runs: { t: number; kss: number }[][]) => runs.map((run) =>
    run.map((pt, i) => `${i ? 'L' : 'M'}${tx(pt.t).toFixed(1)},${ky(pt.kss).toFixed(1)}`).join('')).join('');
  const event = Date.parse(report.event.time_utc);
  const sa = report.self_assessment;
  const ratedAt = sa?.rated_at_utc ? Date.parse(sa.rated_at_utc) : NaN;
  const model = modelAtRating(report);
  const bandFill: Record<string, string> = { moderate: p.moderate, high: p.high, critical: p.critical, extreme: p.extreme };

  const legend: LegendItem[] = [
    { label: series.provisional ? 'Predicted KSS, provisional' : 'Predicted KSS, average pilot', line: { stroke: p.ink, dash: series.provisional ? '5 3' : undefined } },
    { label: '90th-percentile pilot', line: { stroke: p.muted, dash: '2 3', width: 1.25 } },
    { label: 'Sleep, reported', swatch: { fill: p.sleep } },
    { label: 'Sleep, estimated', swatch: { fill: pat('est'), stroke: p.sleep } },
    { label: 'Duty', swatch: { fill: p.duty } },
    ...(sa?.kss != null ? [{ label: 'Pilot self-rating', marker: 'rating' as const }] : []),
    ...(sa?.kss != null && model != null ? [{ label: 'Model at rating', marker: 'model' as const }] : []),
  ];
  const legendTop = axisY + 28;
  const { height: legendH, node: legendNode } = legendRow({ items: legend, x: 0, y: legendTop, width, palette: p, fs: fs - 0.5 });
  const height = legendTop + legendH + 4;
  const zone = `${report.home_base ? `${report.home_base} local` : tz}, ${formatUtcOffset(tz, report.event.time_utc)}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-hidden="true"
      style={{ display: 'block', fontFamily: p.font, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
      <ChartPatterns idPrefix={idPrefix} palette={p} />
      <rect x={0} y={0} width={width} height={height} fill={p.surface} />
      <text x={0} y={11} fontSize={fs - 1} fill={p.muted}>KSS</text>
      {/* Band thresholds: faint fills above 5.5, labelled at the right edge */}
      {KSS_BANDS.map((b) => (
        <g key={b.name}>
          <rect x={x0} y={ky(b.to)} width={x1 - x0} height={ky(b.from) - ky(b.to)} fill={bandFill[b.name]} fillOpacity={0.09} />
          <line x1={x0} x2={x1 + 4} y1={ky(b.from)} y2={ky(b.from)} stroke={bandFill[b.name]} strokeWidth={0.9} strokeDasharray="4 3" />
          <rect x={x1 + 7} y={(ky(b.from) + ky(b.to)) / 2 - 4} width={3} height={8} fill={bandFill[b.name]} />
          <text x={x1 + 13} y={(ky(b.from) + ky(b.to)) / 2 + 3.5} fontSize={fs - 1.5} fill={p.muted}>{`${b.label} ${b.from}`}</text>
        </g>
      ))}
      {[1, 3, 5, 7, 9].map((k) => (
        <g key={k}>
          <line x1={x0} x2={x1} y1={ky(k)} y2={ky(k)} stroke={p.grid} strokeWidth={0.5} />
          <text x={x0 - 6} y={ky(k) + 3.5} fontSize={fs - 1} fill={p.muted} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{k}</text>
        </g>
      ))}
      {/* Day boundaries (local midnight) and 6-hour minor ticks */}
      {ticks.minor.map((m) => (
        <g key={`m${m.t}`}>
          <line x1={tx(m.t)} x2={tx(m.t)} y1={yBottom} y2={axisY - 10} stroke={p.grid} strokeWidth={0.5} />
          {!narrow && <text x={tx(m.t)} y={axisY} fontSize={fs - 2} fill={p.muted} textAnchor="middle">{String(m.hour).padStart(2, '0')}</text>}
        </g>
      ))}
      {ticks.major.map((m) => (
        <g key={`d${m.t}`}>
          <line x1={tx(m.t)} x2={tx(m.t)} y1={top} y2={axisY + 16} stroke={p.grid} strokeWidth={1} />
          <text x={tx(m.t) + 3} y={axisY + 14} fontSize={fs - 1} fill={p.ink} fontWeight={600}>
            {narrow ? dayLabel(m.day).date : dayLabel(m.day).short}
          </text>
        </g>
      ))}
      <text x={x1} y={11} fontSize={fs - 1} fill={p.muted} textAnchor="end">{zone}</text>
      {/* Sleep and duty strips */}
      {report.sleeps.map((s, i) => {
        const a = clipT(Date.parse(s.start_utc)), b = clipT(Date.parse(s.end_utc));
        return b > a ? (
          <rect key={`s${i}`} x={tx(a)} y={stripY} width={Math.max(1, tx(b) - tx(a))} height={stripH} rx={1.5}
            fill={s.source === 'reported' ? p.sleep : pat('est')} stroke={p.sleep} strokeWidth={s.source === 'reported' ? 0 : 0.9}>
            <title>{`Sleep ${s.start_local} to ${s.end_local} (${s.source})`}</title>
          </rect>
        ) : null;
      })}
      {report.duties.map((d, i) => {
        const a = clipT(Date.parse(d.report_utc)), b = clipT(Date.parse(d.release_utc));
        const operated = d.status === 'operated';
        return b > a ? (
          <rect key={`d${i}`} x={tx(a)} y={dutyStripY} width={Math.max(1, tx(b) - tx(a))} height={stripH} rx={1.5}
            fill={operated ? p.duty : d.status === 'planned' ? pat('planned') : pat('cross')}
            stroke={d.is_affected ? p.ink : operated ? 'none' : p.muted} strokeWidth={d.is_affected ? 1.4 : 0.8}
            strokeDasharray={d.status === 'planned' ? '3 2' : undefined}>
            <title>{`${d.flights_label ? `${d.flights_label} ` : ''}${d.route}: ${d.report_local} to ${d.release_local}`}</title>
          </rect>
        ) : null;
      })}
      <text x={x0 - 6} y={stripY + 7.5} fontSize={fs - 2.5} fill={p.muted} textAnchor="end">Sleep</text>
      <text x={x0 - 6} y={dutyStripY + 7.5} fontSize={fs - 2.5} fill={p.muted} textAnchor="end">Duty</text>
      {/* Curves */}
      <path d={path(series.p90)} fill="none" stroke={p.muted} strokeWidth={1.25} strokeDasharray="2 3" />
      <path d={path(series.median)} fill="none" stroke={p.ink} strokeWidth={2} strokeLinejoin="round" strokeDasharray={series.provisional ? '5 3' : undefined} />
      {series.peak && (
        <g>
          <circle cx={tx(series.peak.t)} cy={ky(series.peak.kss)} r={3} fill={p.ink} />
          <text x={tx(series.peak.t) + (tx(series.peak.t) > x1 - 24 ? -6 : 0)} y={ky(series.peak.kss) - 7} fontSize={fs - 1} fill={p.ink}
            textAnchor={tx(series.peak.t) > x1 - 24 ? 'end' : 'middle'} fontWeight={600}
            style={{ fontVariantNumeric: 'tabular-nums' }}>{`Peak ${series.peak.kss.toFixed(1)}`}</text>
        </g>
      )}
      {/* Event line */}
      {event >= start && event <= end && (
        <g>
          <line x1={tx(event)} x2={tx(event)} y1={top} y2={dutyStripY + stripH} stroke={p.event} strokeWidth={1.5} />
          <text x={tx(event) + (tx(event) > x1 - 80 ? -4 : 4)} y={top + 10} fontSize={fs - 1} fill={p.event} fontWeight={600}
            textAnchor={tx(event) > x1 - 80 ? 'end' : 'start'}>
            {`${report.event.type === 'roster_concern' ? 'Concern' : 'Event'} ${formatClock(report.event.time_utc, tz)}`}
          </text>
        </g>
      )}
      {/* Pilot self-rating vs model */}
      {sa?.kss != null && Number.isFinite(ratedAt) && ratedAt >= start && ratedAt <= end && (
        <g>
          {model != null && (
            <>
              <line x1={tx(ratedAt)} x2={tx(ratedAt)} y1={ky(model)} y2={ky(sa.kss)} stroke={p.ink} strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={tx(ratedAt)} cy={ky(model)} r={4} fill={p.surface} stroke={p.ink} strokeWidth={1.5} />
            </>
          )}
          <path d={`M${tx(ratedAt)},${ky(sa.kss) - 7} l6,7 l-6,7 l-6,-7 z`} fill={p.rating} stroke={p.surface} strokeWidth={1.5} />
          <text x={tx(ratedAt) - 9} y={ky(sa.kss) + 4} fontSize={fs - 1} fill={p.ink} textAnchor="end" fontWeight={600}>{`Self ${sa.kss}`}</text>
        </g>
      )}
      {series.provisional && (
        <text x={(x0 + x1) / 2} y={top + plotH - 8} fontSize={fs - 1} fill={p.muted} textAnchor="middle">
          Provisional: diary not confirmed complete; gaps are modelled as awake
        </text>
      )}
      {legendNode}
    </svg>
  );
}
