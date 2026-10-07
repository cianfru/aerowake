import { useMemo } from 'react';
import { formatDay } from '../landingFormat';
import { useMeasuredWidth } from '../useMeasuredWidth';
import { TOUR_WEEK } from '../tourData';
import { LegendKey } from './PreviewParts';

const HOURS = TOUR_WEEK.kss.length * TOUR_WEEK.stepHours;
const LINE = 'var(--lp-175779)';

/** Sleep & recovery: the engine's predicted KSS through one week, with sleep and duty behind it. */
export function SleepPreview() {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(520);
  const h = 200;
  const m = { top: 12, right: 12, bottom: 24, left: 24 };
  const iw = width - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const x = (hours: number) => m.left + (hours / HOURS) * iw;
  const y = (k: number) => m.top + (1 - (k - 1) / 8) * ih;
  const path = useMemo(() => {
    let d = '';
    let pen = false;
    TOUR_WEEK.kss.forEach((k, i) => {
      if (k == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i * TOUR_WEEK.stepHours).toFixed(1)} ${y(k).toFixed(1)}`;
      pen = true;
    });
    return d;
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${TOUR_WEEK.start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return formatDay(d.toISOString().slice(0, 10)).split(' ')[0];
  });

  return <div className="space-y-4">
    <p className="text-xs font-medium text-[color:var(--lp-304a5f)]">Predicted sleepiness through the week, while awake</p>
    <div ref={ref}>
      <svg width={width} height={h} role="img" aria-label="Predicted KSS for one week, rising late in long days and during overnight duties, with estimated sleep between duties" className="block max-w-full">
        {TOUR_WEEK.sleep.map(([a, b]) => <rect key={a} x={x(a)} y={m.top} width={x(b) - x(a)} height={ih} fill="var(--lp-e6edf2)" />)}
        {TOUR_WEEK.duties.map(([a, b]) => <rect key={a} x={x(a)} y={m.top + ih - 5} width={x(b) - x(a)} height={5} rx={2} fill="var(--lp-17384f)" />)}
        {[6.5, 7.5].map((k) => <g key={k}>
          <line x1={m.left} x2={m.left + iw} y1={y(k)} y2={y(k)} stroke="var(--lp-dbe5eb)" />
          <text x={m.left + iw} y={y(k) - 3} textAnchor="end" className="fill-[color:var(--lp-526579)] text-[10px]" style={{ paintOrder: 'stroke', stroke: 'var(--lp-fcfdfe)', strokeWidth: 3 }}>{k === 6.5 ? 'High 6.5' : 'Critical 7.5'}</text>
        </g>)}
        {[1, 5, 9].map((k) => <text key={k} x={m.left - 7} y={y(k) + 3.5} textAnchor="end" className="fill-[color:var(--lp-526579)] font-mono text-[10px]">{k}</text>)}
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {days.map((day, i) => <text key={day + i} x={x(i * 24 + 12)} y={h - 5} textAnchor="middle" className="fill-[color:var(--lp-526579)] text-[10px]">{day}</text>)}
      </svg>
    </div>
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--lp-425d73)]">
      <LegendKey swatch={<span className="h-0.5 w-5 rounded-full" style={{ background: LINE }} />}>Predicted KSS (awake)</LegendKey>
      <LegendKey swatch={<span className="h-2.5 w-5 rounded-[3px] bg-[color:var(--lp-e6edf2)]" />}>Estimated sleep</LegendKey>
      <LegendKey swatch={<span className="h-1.5 w-5 rounded-[2px] bg-[color:var(--lp-17384f)]" />}>Duty</LegendKey>
    </ul>
    <p className="text-xs leading-5 text-[color:var(--lp-526579)]">Home-base time. Sleep outside duties is estimated from the roster until you confirm what you actually slept.</p>
  </div>;
}
