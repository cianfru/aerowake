import { Check, Info } from 'lucide-react';
import { TOUR_FTL, TOUR_TOTALS } from '../tourData';

const hours = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

/** FTL checks: rolling totals against EASA limits, honest about what was supplied. */
export function FtlPreview() {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium text-[#142e45]"><Check aria-hidden="true" className="h-4 w-4 text-[#087478]" />No exceedances found in the supplied activities</p>
      <p className="text-xs text-[#526579]">QCAA / EASA flight time limitations</p>
    </div>
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TOUR_FTL.map((row) => <li key={row.label} className="rounded-xl border border-[#dbe7ed] bg-[#f3f8fa] p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#526579]">{row.label}</p>
        <p className="mt-1.5 font-mono text-lg text-[#142e45]">{hours(row.hours)}<span className="text-sm text-[#526579]">/{row.limit} h</span></p>
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dde8ee]"><div className="h-full rounded-full bg-[#5d7385]" style={{ width: `${(row.hours / row.limit) * 100}%` }} /></div>
      </li>)}
    </ul>
    <p className="text-sm leading-6 text-[#425d73]">Maximum daily FDP checked for {TOUR_TOTALS.duties} of {TOUR_TOTALS.duties} duties against the basic table; crew and acclimatisation context is needed to confirm each one.</p>
    <p className="flex gap-2 rounded-xl border border-[#dbe7ed] bg-[#fcfdfe] p-3.5 text-xs leading-5 text-[#425d73]"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#526579]" />These checks cover only what you supplied. Duty before the roster month and your operator’s approvals are not verified, so rolling totals are a lower bound.</p>
  </div>;
}
