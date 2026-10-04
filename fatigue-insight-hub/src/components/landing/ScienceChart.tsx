import { useMemo, useState } from 'react';
import { BAND_LINES, HOURS, N, SCIENCE_PEAKS, SCIENCE_SCENARIO as S, SERIES, clockAt } from './scienceData';
import { formatKssValue } from './landingKss';
import { useMeasuredWidth } from './useMeasuredWidth';

function linePath(values: readonly (number | null)[], x: (h: number) => number, y: (k: number) => number): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i * S.stepHours).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/** Published-model comparison: one overnight duty, with and without an afternoon nap. */
export function ScienceChart() {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);
  const compact = width < 480;
  const height = compact ? 260 : 300;
  const m = { top: 16, right: compact ? 10 : 70, bottom: 58, left: 28 };
  const iw = Math.max(10, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const x = (h: number) => m.left + (h / HOURS) * iw;
  const y = (k: number) => m.top + (1 - (k - 1) / 8) * ih;
  const paths = useMemo(() => SERIES.map((s) => linePath(s.values, x, y)), [width]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = compact ? [0, 8, 16, 24] : [0, 4, 8, 12, 16, 20, 24];
  const strip = m.top + ih + 10;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (N - 1));
    setHover(Math.max(0, Math.min(N - 1, i)));
  };

  return <div>
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[#425d73]" aria-label="Legend">
      {SERIES.map((s) => <li key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: s.color }} />{s.label}</li>)}
    </ul>
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Predicted KSS for the same overnight duty with and without a two-hour afternoon nap" className="block max-w-full overflow-visible">
        <rect x={x(S.wocl[0])} y={m.top} width={x(S.wocl[1]) - x(S.wocl[0])} height={ih} fill="#eee8f6" />
        <text x={x(S.wocl[0]) + 5} y={m.top + 12} className="fill-[#5f4d78] text-[10px] font-semibold uppercase tracking-[0.08em]">WOCL</text>
        <line x1={m.left} x2={m.left + iw} y1={y(1)} y2={y(1)} stroke="#c9d7df" />
        {BAND_LINES.map((b) => <g key={b.kss}>
          <line x1={m.left} x2={m.left + iw} y1={y(b.kss)} y2={y(b.kss)} stroke="#dbe5eb" />
          {!compact && <text x={m.left + iw + 6} y={y(b.kss) + 3.5} className="fill-[#526579] text-[10px]">{b.kss} {b.label}</text>}
        </g>)}
        {[1, 3, 5, 7, 9].map((k) => <text key={k} x={m.left - 8} y={y(k) + 3.5} textAnchor="end" className="fill-[#526579] font-mono text-[10px]">{k}</text>)}
        {SERIES.map((s, i) => <path key={s.key} d={paths[i]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {SCIENCE_PEAKS.map((p, i) => <g key={p.key}>
          <circle cx={x(p.index * S.stepHours)} cy={y(p.kss)} r={4.5} fill={SERIES[i].color} stroke="#fcfdfe" strokeWidth={2} />
          <text x={x(p.index * S.stepHours) + 8} y={y(p.kss) + (i === 0 ? -6 : 14)} className="fill-[#142e45] font-mono text-[11px] font-semibold">{formatKssValue(p.kss)}</text>
        </g>)}
        <rect x={x(S.duty[0])} y={strip} width={x(S.duty[1]) - x(S.duty[0])} height={6} rx={3} fill="#17384f" />
        <text x={x(S.duty[0])} y={strip + 18} className="fill-[#304a5f] text-[10px] font-medium">Duty {clockAt(S.duty[0])}–{clockAt(S.duty[1])}</text>
        <rect x={x(S.nap[0])} y={strip} width={x(S.nap[1]) - x(S.nap[0])} height={6} rx={3} fill="#0e6f86" />
        <text x={x(S.nap[0])} y={strip + 18} className="fill-[#304a5f] text-[10px] font-medium">Nap</text>
        {ticks.map((h) => <text key={h} x={x(h)} y={height - 6} textAnchor={h === 0 ? 'start' : h === 24 && compact ? 'end' : 'middle'} className="fill-[#526579] font-mono text-[10px]">{clockAt(h)}</text>)}
        {hover != null && <line x1={x(hover * S.stepHours)} x2={x(hover * S.stepHours)} y1={m.top} y2={m.top + ih} stroke="#304a5f" strokeWidth={1} />}
        <rect x={m.left} y={m.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover != null && <div className="pointer-events-none absolute top-2 z-10 min-w-[10.5rem] rounded-lg border border-[#c9dbe4] bg-[#fcfdfe] px-3 py-2 text-xs text-[#304a5f] shadow-[0_8px_20px_-10px_#17384f66]"
        style={{ left: Math.min(Math.max(x(hover * S.stepHours) + 10, 0), width - 176) }}>
        <p className="mb-1 font-mono font-semibold text-[#142e45]">{clockAt(hover * S.stepHours)}</p>
        {SERIES.map((s) => {
          const v = s.values[hover];
          return <p key={s.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />{s.key === 'nap' ? 'With nap' : 'No nap'}</span><span className="font-mono text-[#142e45]">{v == null ? 'asleep or just woken' : formatKssValue(v)}</span></p>;
        })}
      </div>}
    </div>
    <div className="sr-only"><table>
      <caption>Predicted KSS at key times, home-base time</caption>
      <thead><tr><th scope="col">Time</th>{SERIES.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
      <tbody>{[S.duty[0], 20, S.duty[1]].map((h) => <tr key={h}><th scope="row">{clockAt(h)}</th>{SERIES.map((s) => <td key={s.key}>{formatKssValue(s.values[Math.round(h / S.stepHours)] ?? 0)}</td>)}</tr>)}</tbody>
    </table></div>
  </div>;
}
