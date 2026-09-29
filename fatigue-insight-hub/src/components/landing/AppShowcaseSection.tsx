import { ScrollReveal } from './ScrollReveal';

const example = [
  { date: 'MON 08', route: 'DOH → LHR', time: '06:10 – 14:35 UTC', kss: '5.2', label: 'Low', color: 'text-slate-300' },
  { date: 'WED 10', route: 'DOH → BKK', time: '21:40 – 06:15 UTC +1', kss: '7.8', label: 'Critical', color: 'text-rose-300' },
  { date: 'FRI 12', route: 'BKK → DOH', time: '13:20 – 21:05 UTC', kss: '6.1', label: 'Moderate', color: 'text-amber-200' },
];

/** Illustrative data stays legible on phones and never impersonates a pilot record. */
export function AppShowcaseSection() {
  return <section className="bg-[#000408] py-20 md:py-28" id="sample-report">
    <div className="mx-auto max-w-7xl space-y-16 px-6 md:px-10 lg:px-16">
      <ScrollReveal><div className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div className="max-w-md space-y-5">
          <p className="text-xs uppercase tracking-[.18em] text-sky-300">From schedule to understanding</p>
          <h2 className="font-serif text-4xl font-light leading-tight text-white">See the duties<br />that deserve a closer look.</h2>
          <p className="text-base leading-7 text-slate-300">A clear view of peak predicted sleepiness, the timing behind it, and the assumptions that matter. Your own experience always comes first.</p>
          <p className="text-sm leading-6 text-slate-400">KSS runs from 1 (extremely alert) to 9 (fighting sleep). Predictions support a conversation; they do not decide whether you are fit to fly.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-[#0b1521] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 px-5 py-4"><span className="text-sm font-medium text-white">Your roster at a glance</span><span className="text-xs text-slate-400">Illustrative data</span></div>
          <div className="divide-y divide-slate-700/60 px-5">{example.map(d => <div key={d.date} className="grid grid-cols-[1fr_auto] items-center gap-4 py-6">
            <div className="space-y-2"><p className="font-mono text-xs tracking-wide text-slate-400">{d.date}</p><p className="text-lg font-medium text-white">{d.route}</p><p className="font-mono text-xs text-slate-300">{d.time}</p></div>
            <div className="text-right"><p className={`font-mono text-2xl ${d.color}`}>{d.kss}<span className="ml-1 text-xs text-slate-400">KSS</span></p><p className={`mt-1 text-xs ${d.color}`}>{d.label} · duty peak</p></div>
          </div>)}</div>
          <p className="border-t border-slate-700/70 px-5 py-4 text-sm leading-6 text-slate-300"><span className="text-rose-300">Wednesday needs review.</span> The duty runs through the body-clock low. Check your planned rest and how you actually feel.</p>
        </div>
      </div></ScrollReveal>
      <ScrollReveal><div className="grid gap-8 border-t border-slate-800 pt-12 md:grid-cols-3">
        {[
          ['01', 'Review the import', 'Confirm dates, airports and time zones. See source totals and inferred times before you run the model.'],
          ['02', 'Add what happened', 'Record actual sleep, your fatigue event and your own words. Estimates and missing history stay clearly labelled.'],
          ['03', 'Keep a clear record', 'Review the report, edit your inputs, and export text, JSON or a print copy for your reporting process.'],
        ].map(([n, title, body]) => <div key={n} className="space-y-3"><span className="font-mono text-sm text-sky-300">{n}</span><h3 className="text-xl font-medium text-white">{title}</h3><p className="text-sm leading-7 text-slate-300">{body}</p></div>)}
      </div></ScrollReveal>
    </div>
  </section>;
}
