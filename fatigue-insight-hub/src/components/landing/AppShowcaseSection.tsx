import { ScrollReveal } from './ScrollReveal';

const example = [
  { date: 'MON 08', route: 'DOH → LHR', time: '06:10 – 14:35 UTC', kss: '5.2', label: 'Lower predicted sleepiness', color: 'text-[#425d73]' },
  { date: 'WED 10', route: 'DOH → BKK', time: '21:40 – 06:15 UTC +1', kss: '7.8', label: 'Elevated predicted sleepiness', color: 'text-[#a6284d]' },
  { date: 'FRI 12', route: 'BKK → DOH', time: '13:20 – 21:05 UTC', kss: '6.1', label: 'Moderate predicted sleepiness', color: 'text-[#8a540a]' },
];

/** Illustrative data stays legible on phones and never impersonates a pilot record. */
export function AppShowcaseSection() {
  return <section className="bg-[#f8fbfd] py-20 md:py-28" id="sample-report">
    <div className="mx-auto max-w-7xl space-y-16 px-6 md:px-10 lg:px-16">
      <ScrollReveal><div className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div className="max-w-md space-y-5">
          <p className="text-sm font-medium text-[#087478]">From schedule to understanding</p>
          <h2 className="font-serif text-4xl font-light leading-tight text-[#142e45]">See the duties<br />that deserve a closer look.</h2>
          <p className="text-base leading-7 text-[#425d73]">A clear view of peak predicted sleepiness, the timing behind it, and the assumptions that matter. Your own experience always comes first.</p>
          <p className="text-sm leading-6 text-[#526579]">KSS runs from 1 (extremely alert) to 9 (fighting sleep). Predictions support a conversation; they do not decide whether you are fit to fly.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#bdced7] bg-[#fcfdfe] shadow-[0_3px_5px_#285c7608,0_28px_56px_-28px_#285c7650]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#325969] bg-[#1a3f52] px-6 py-5"><span className="text-sm font-medium text-[#f4f8fa]">Your roster at a glance</span><span className="text-xs text-[#c0d7e1]">Illustrative data</span></div>
          <div className="divide-y divide-[#c6dbe6] px-6">{example.map(d => <div key={d.date} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-6">
            <div className="space-y-2"><p className="font-mono text-xs tracking-wide text-[#526579]">{d.date}</p><p className="text-lg font-medium text-[#142e45]">{d.route}</p><p className="font-mono text-xs text-[#425d73]">{d.time}</p></div>
            <div className="max-w-[7.5rem] text-right sm:max-w-none"><p className={`font-mono text-2xl ${d.color}`}>{d.kss}<span className="ml-1 text-xs text-[#526579]">KSS</span></p><p className={`mt-1 text-xs ${d.color}`}>{d.label} · duty peak</p></div>
          </div>)}</div>
          <p className="border-t border-[#c6dbe6] bg-[#edf3f6] px-6 py-5 text-sm leading-6 text-[#425d73]"><span className="font-medium text-[#a6284d]">Wednesday needs review.</span> The duty runs through the body-clock low. Check your planned rest and how you actually feel.</p>
        </div>
      </div></ScrollReveal>
      <ScrollReveal><div className="grid gap-8 border-t border-[#c6dbe6] pt-12 md:grid-cols-3">
        {[
          ['01', 'Start with your recent days', 'Upload your roster, or enter your duties manually. Confirm the dates, airports and times.'],
          ['02', 'Add what happened', 'Record actual sleep, your fatigue event and your own words. Estimates and missing history stay clearly labelled.'],
          ['03', 'Keep a clear record', 'Review the report, edit your inputs, and copy a submission summary, download text or save a PDF for your reporting process.'],
        ].map(([n, title, body]) => <div key={n} className="space-y-4"><span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b6cfd6] bg-[#e7f0f2] text-sm font-semibold text-[#176b74] shadow-[inset_0_1px_0_#fcfdfe]">{n}</span><h3 className="text-xl font-medium text-[#142e45]">{title}</h3><p className="text-base leading-7 text-[#425d73]">{body}</p></div>)}
      </div></ScrollReveal>
    </div>
  </section>;
}
