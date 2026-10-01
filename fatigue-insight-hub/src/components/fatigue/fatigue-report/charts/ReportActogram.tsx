import type { FatigueReport } from '@/lib/fatigue-report-api';
import { formatDuration, formatUtcOffset } from '@/lib/report-time';
import { buildActogram, type ActogramDuty } from './chart-model';
import type { ChartPalette } from './chart-palette';
import { ChartPatterns } from './chart-parts';
import { legendRow, type LegendItem } from './chart-legend';

/**
 * 72-hour sleep–duty actogram in home-base local time: one row per calendar
 * day (00–24), sleep on the upper lane, duties and flight sectors on the lower
 * lane, WOCL (02:00–05:59) shaded, event and self-rating marked. Needs no model.
 */
export function ReportActogram({ report, width, palette, idPrefix }: {
  report: FatigueReport; width: number; palette: ChartPalette; idPrefix: string;
}) {
  const { rows } = buildActogram(report);
  const narrow = width < 560;
  const fs = 11;
  const labelW = narrow ? 50 : 78;
  const totalsW = narrow ? 0 : 84;
  const x0 = labelW;
  const x1 = width - totalsW - 6;
  const hx = (h: number) => x0 + (h / 24) * (x1 - x0);
  const top = 30;
  const rowH = narrow ? 58 : 50;
  const sleepY = 5, sleepH = 13, dutyY = 21, dutyH = 13;
  const plotBottom = top + rows.length * rowH;
  const p = palette;
  const pat = (name: string) => `url(#${idPrefix}-${name})`;
  const tz = report.home_timezone;
  const zone = `${report.home_base ? `${report.home_base} local` : tz}, ${formatUtcOffset(tz, report.event.time_utc)}`;
  const kss = report.self_assessment?.kss;

  const dutyStyle = (d: ActogramDuty) => {
    switch (d.status) {
      case 'operated': return { fill: p.duty, stroke: d.affected ? p.ink : 'none', dash: undefined };
      case 'planned': return { fill: pat('planned'), stroke: d.affected ? p.ink : p.muted, dash: '3 2' };
      default: return { fill: pat('cross'), stroke: d.affected ? p.ink : p.muted, dash: undefined };
    }
  };

  const legend: LegendItem[] = [
    { label: 'Sleep, reported', swatch: { fill: p.sleep } },
    { label: 'Sleep, estimated', swatch: { fill: pat('est'), stroke: p.sleep } },
    { label: 'Duty, operated', swatch: { fill: p.duty } },
    { label: 'Duty, planned', swatch: { fill: pat('planned'), stroke: p.muted, dash: '3 2' } },
    { label: 'Not operated', swatch: { fill: pat('cross'), stroke: p.muted } },
    { label: 'Flight sector', swatch: { fill: p.sector, thin: true } },
    { label: 'WOCL 02:00–05:59', swatch: { fill: pat('wocl') } },
    { label: report.event.type === 'roster_concern' ? 'Concern' : 'Event', marker: 'event' },
    ...(kss != null ? [{ label: 'Self-rating', marker: 'rating' as const }] : []),
  ];
  const legendTop = plotBottom + 16;
  const { height: legendH, node: legendNode } = legendRow({ items: legend, x: 0, y: legendTop, width, palette: p, fs: fs - 0.5 });
  const height = legendTop + legendH + 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-hidden="true"
      style={{ display: 'block', fontFamily: p.font, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
      <ChartPatterns idPrefix={idPrefix} palette={p} />
      <rect x={0} y={0} width={width} height={height} fill={p.surface} />
      {/* WOCL band across all rows */}
      <rect x={hx(2)} y={top} width={hx(6) - hx(2)} height={plotBottom - top} fill={pat('wocl')} />
      {/* Hour grid and top axis */}
      <text x={x0} y={10} fontSize={fs - 1} fill={p.muted}>{zone}</text>
      {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
        <g key={h}>
          <line x1={hx(h)} x2={hx(h)} y1={top - 4} y2={plotBottom} stroke={p.grid} strokeWidth={h % 6 === 0 ? 1 : 0.5}
            strokeDasharray={h % 6 === 0 ? undefined : '2 3'} />
          {(h % 6 === 0 || !narrow) && (
            <text x={hx(h)} y={top - 8} fontSize={fs - 1} fill={p.muted} textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              style={{ fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}</text>
          )}
        </g>
      ))}
      {rows.map((row, i) => {
        const y = top + i * rowH;
        return (
          <g key={row.day}>
            <line x1={0} x2={width} y1={y} y2={y} stroke={p.grid} strokeWidth={0.75} />
            <text x={0} y={y + 16} fontSize={fs} fontWeight={600} fill={p.ink}>{row.label.weekday}</text>
            <text x={0} y={y + 30} fontSize={fs - 1} fill={p.muted}>{row.label.date}</text>
            {narrow && (
              <text x={0} y={y + 44} fontSize={fs - 2} fill={p.muted}>{`S ${formatDuration(row.sleepHours)}`}</text>
            )}
            {row.sleeps.map((s, k) => (
              <rect key={`s${k}`} x={hx(s.x0)} y={y + sleepY} width={Math.max(1, hx(s.x1) - hx(s.x0))} height={sleepH} rx={2}
                fill={s.source === 'reported' ? p.sleep : pat('est')} stroke={p.sleep} strokeWidth={s.source === 'reported' ? 0 : 1}>
                <title>{s.title}</title>
              </rect>
            ))}
            {row.duties.map((d, k) => {
              const st = dutyStyle(d);
              return (
                <rect key={`d${k}`} x={hx(d.x0)} y={y + dutyY} width={Math.max(1, hx(d.x1) - hx(d.x0))} height={dutyH} rx={2}
                  fill={st.fill} stroke={st.stroke} strokeWidth={d.affected ? 1.5 : 1} strokeDasharray={st.dash}>
                  <title>{d.title}</title>
                </rect>
              );
            })}
            {row.sectors.map((s, k) => (
              <rect key={`f${k}`} x={hx(s.x0)} y={y + dutyY + 4} width={Math.max(1, hx(s.x1) - hx(s.x0))} height={dutyH - 8} fill={p.sector} />
            ))}
            {row.duties.filter((d) => d.label).map((d, k) => {
              const x = hx(d.x0);
              const text = `${d.affected ? '★ ' : ''}${d.label}`;
              const room = x1 - x;
              return room > 40 ? (
                <text key={`l${k}`} x={x} y={y + dutyY + dutyH + 11} fontSize={fs - 1.5} fill={p.ink}>
                  {text.length * 5.6 > room ? `${text.slice(0, Math.max(3, Math.floor(room / 5.6) - 1))}…` : text}
                </text>
              ) : null;
            })}
            {row.event != null && (
              <g>
                <line x1={hx(row.event)} x2={hx(row.event)} y1={y + 1} y2={y + rowH - 2} stroke={p.event} strokeWidth={1.5} />
                <path d={`M${hx(row.event)},${y + rowH - 12} l5,9 h-10 z`} fill={p.event} />
              </g>
            )}
            {row.rating != null && kss != null && (
              <g>
                <path d={`M${hx(row.rating)},${y + sleepY - 2} l5,6.5 l-5,6.5 l-5,-6.5 z`} fill={p.rating} stroke={p.surface} strokeWidth={1} />
                <text x={hx(row.rating) + 8} y={y + sleepY + 9} fontSize={fs - 1.5} fill={p.ink} fontWeight={600}>{`KSS ${kss}`}</text>
              </g>
            )}
            {!narrow && (
              <g>
                <text x={width} y={y + 16} fontSize={fs - 1} fill={p.ink} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {`Sleep ${formatDuration(row.sleepHours)}`}
                </text>
                <text x={width} y={y + 31} fontSize={fs - 1} fill={p.muted} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {`Duty ${formatDuration(row.dutyHours)}`}
                </text>
              </g>
            )}
          </g>
        );
      })}
      <line x1={0} x2={width} y1={plotBottom} y2={plotBottom} stroke={p.grid} strokeWidth={0.75} />
      {legendNode}
    </svg>
  );
}
