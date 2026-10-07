import { cn } from '@/lib/utils';
import { RISK_LEVEL_LABELS, riskClasses, riskCssColor, type RiskLevel } from '@/lib/risk-scale';
import { useMeasuredWidth } from '../useMeasuredWidth';
import { formatKssValue, kssBand, roundKss } from '../landingKss';
import { formatDay, formatRoute } from '../landingFormat';
import { TOUR_DUTIES, TOUR_WATCH_KSS } from '../tourData';
import { dutiesToWatch, highestDuty } from '../tourModel';
import { LegendKey, PreviewFact } from './PreviewParts';

const WATCH = dutiesToWatch();
const FIRST = WATCH[0];
const HIGHEST = highestDuty();
const ORDER: RiskLevel[] = ['low', 'moderate', 'high', 'critical', 'extreme'];
const BANDS_SHOWN = ORDER.filter((level) => TOUR_DUTIES.some((d) => kssBand(d.peakKss) === level));
const Y_MIN = 3;
const Y_MAX = 8;

/** Outlook: duty peaks through the month against the personal watch level. */
export function OutlookPreview() {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(520);
  const h = 150;
  const m = { top: 14, right: 12, bottom: 22, left: 26 };
  const iw = width - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const x = (day: number) => m.left + ((day - 1) / 30) * iw;
  const y = (k: number) => m.top + (1 - (k - Y_MIN) / (Y_MAX - Y_MIN)) * ih;

  return <div className="space-y-5">
    <div className="grid gap-4 rounded-xl border border-[color:var(--lp-dbe7ed)] bg-[color:var(--lp-f3f8fa)] p-4 sm:grid-cols-2">
      <PreviewFact label={`First duty reaching your watch level (${TOUR_WATCH_KSS})`} value={formatDay(FIRST.date)} sub={`${formatRoute(FIRST.route)} · peak KSS ${formatKssValue(FIRST.peakKss)}`} />
      <PreviewFact label="Highest predicted sleepiness" value={<>{formatKssValue(HIGHEST.peakKss)} <span className="text-sm font-normal text-[color:var(--lp-526579)]">KSS · {formatDay(HIGHEST.date)}</span></>} sub="KSS runs from 1 (extremely alert) to 9 (fighting sleep)." />
    </div>
    <div>
      <p className="mb-2 text-xs font-medium text-[color:var(--lp-304a5f)]">Duty peaks through the month</p>
      <div ref={ref}>
        <svg width={width} height={h} role="img" aria-label={`Peak predicted KSS for ${TOUR_DUTIES.length} duties; ${WATCH.length} reach the watch level of ${TOUR_WATCH_KSS}.`} className="block max-w-full overflow-visible">
          {[4, 6, 8].map((k) => <text key={k} x={m.left - 8} y={y(k) + 3.5} textAnchor="end" className="fill-[color:var(--lp-526579)] font-mono text-[10px]">{k}</text>)}
          <line x1={m.left} x2={m.left + iw} y1={m.top + ih} y2={m.top + ih} stroke="var(--lp-c9d7df)" />
          <line x1={m.left} x2={m.left + iw} y1={y(TOUR_WATCH_KSS)} y2={y(TOUR_WATCH_KSS)} stroke="var(--lp-304a5f)" strokeDasharray="4 4" strokeWidth={1} />
          {TOUR_DUTIES.map((d) => {
            const day = Number(d.date.slice(8, 10));
            const k = roundKss(d.peakKss);
            return <g key={d.date}>
              <line x1={x(day)} x2={x(day)} y1={m.top + ih} y2={y(k)} stroke="var(--lp-dbe5eb)" strokeWidth={2} strokeLinecap="round" />
              <circle cx={x(day)} cy={y(k)} r={5} fill={riskCssColor(kssBand(k))} stroke="var(--lp-fcfdfe)" strokeWidth={2} />
            </g>;
          })}
          {width >= 480 && <text x={x(Number(HIGHEST.date.slice(8, 10))) + 9} y={y(roundKss(HIGHEST.peakKss)) + 4} className="fill-[color:var(--lp-142e45)] font-mono text-[11px] font-semibold">{formatKssValue(HIGHEST.peakKss)}</text>}
          {[1, 8, 15, 22, 29].map((day) => <text key={day} x={x(day)} y={h - 4} textAnchor="middle" className="fill-[color:var(--lp-526579)] font-mono text-[10px]">{day}</text>)}
        </svg>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--lp-425d73)]">
        <LegendKey swatch={<span className="w-5 border-t border-dashed border-[color:var(--lp-304a5f)]" />}>Your watch level, KSS {TOUR_WATCH_KSS}</LegendKey>
        {BANDS_SHOWN.map((level) => <LegendKey key={level} swatch={<span className={cn('h-2.5 w-2.5 rounded-full', riskClasses(level).fill)} />}>{RISK_LEVEL_LABELS[level]} peak</LegendKey>)}
      </ul>
    </div>
    <p className="text-sm text-[color:var(--lp-425d73)]"><span className="font-semibold text-[color:var(--lp-142e45)]">{WATCH.length} of {TOUR_DUTIES.length} duties</span> reach your watch level. Your watch level is a personal prompt; it never changes the model bands.</p>
  </div>;
}
