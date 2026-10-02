import { FlaskConical } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { ScienceChart } from './ScienceChart';
import { ArcMotif } from './ArcMotif';
import { SCIENCE_CITATIONS, sciencePeakSummary } from './scienceData';

const PROCESSES = [
  { name: 'Sleep pressure', tag: 'Process S', body: 'Builds the longer you are awake and recovers while you sleep, so a short night carries into the next duty.' },
  { name: 'Body clock', tag: 'Process C', body: 'A 24-hour rhythm, lowest in the early morning. It is timed to your home base and adjusts as you acclimatise.' },
  { name: 'Ultradian rhythm', tag: 'Process U', body: 'A smaller 12-hour wave, including the familiar early-afternoon dip.' },
];

const UNKNOWNS = [
  'Sleep you have not entered. Estimates stay labelled until you confirm what you actually slept.',
  'Caffeine, illness, stress, workload and your own differences. For a single rating, the model’s typical error is about 1.4 KSS points.',
  'Whether you are fit to fly. That stays with you and your operator’s procedures.',
];

export function ScienceSection() {
  return <section id="science" aria-labelledby="science-title" className="landing-section landing-navy overflow-hidden">
    <ArcMotif className="right-[-12rem] top-[-10rem] h-[40rem] w-[40rem] opacity-[0.05]" />
    <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
      <ScrollReveal className="max-w-3xl space-y-5">
        <p className="landing-eyebrow">The science</p>
        <h2 id="science-title" className="landing-h2">A published model, tested on airline crew.</h2>
        <p className="text-lg leading-8 text-[#c9dde6]">Aerowake uses the Three Process Model of alertness in the form Ingre and colleagues validated on airline pilots (2014, model 5c). It turns your sleep and duty times into predicted sleepiness on the Karolinska Sleepiness Scale, through every hour of the roster.</p>
      </ScrollReveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[.86fr_1.14fr] lg:gap-14">
        <ScrollReveal className="space-y-8">
          <dl className="space-y-5">
            {PROCESSES.map((p) => <div key={p.name} className="grid grid-cols-[7.75rem_1fr] gap-4 border-t border-[#2c566b] pt-4">
              <dt><span className="block font-medium text-[#f4f8fa]">{p.name}</span><span className="font-mono text-xs text-[#8fb0c0]">{p.tag}</span></dt>
              <dd className="text-sm leading-6 text-[#c9dde6]">{p.body}</dd>
            </div>)}
            <div className="grid grid-cols-[7.75rem_1fr] gap-4 border-t border-[#2c566b] pt-4">
              <dt><span className="block font-medium text-[#f4f8fa]">Sleep inertia</span><span className="font-mono text-xs text-[#8fb0c0]">not modelled</span></dt>
              <dd className="text-sm leading-6 text-[#c9dde6]">The crew study fitted better without it, so the first hour after waking is flagged rather than scored.</dd>
            </div>
          </dl>
          <div className="rounded-2xl border border-[#2f5a6f] bg-[#0d2636]/60 p-5 shadow-[inset_0_1px_0_#ffffff0f]">
            <h3 className="font-medium text-[#f4f8fa]">What the model can’t know</h3>
            <ul className="mt-3 space-y-2.5 text-sm leading-6 text-[#c9dde6]">
              {UNKNOWNS.map((u) => <li key={u} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[#7fd0dc]" />{u}</li>)}
            </ul>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <figure className="landing-card p-5 text-[#142e45] sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">One overnight duty, two ways to prepare</h3>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#526579]">Published model · group average</span>
            </div>
            <ScienceChart />
            <figcaption className="mt-4 space-y-2 border-t border-[#dbe7ed] pt-4 text-sm leading-6 text-[#425d73]">
              <p>{sciencePeakSummary()}</p>
              <p className="text-xs leading-5 text-[#526579]">Home-base time. Usual sleep 23:00–07:00 on the nights before. Lines pause during sleep and for the first hour after waking.</p>
            </figcaption>
          </figure>
        </ScrollReveal>
      </div>

      <div className="mt-14 grid gap-8 border-t border-[#2c566b] pt-8 lg:grid-cols-[.86fr_1.14fr] lg:gap-14">
        <p className="flex items-start gap-3 text-sm leading-6 text-[#c9dde6]">
          <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#7fd0dc]" />
          <span><span className="font-medium text-[#f4f8fa]">Independent scientific and FTL evaluation in progress.</span> Published equations and passing tests are not operational validation, so treat every figure as a planning aid.</span>
        </p>
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8fb0c0]">References</h3>
          <ol className="space-y-2 text-xs leading-5 text-[#b9d0db]">
            {SCIENCE_CITATIONS.map((c) => <li key={c.text}>{c.href ? <a href={c.href} target="_blank" rel="noreferrer" className="underline decoration-[#8fdce6]/40 underline-offset-4 hover:decoration-[#8fdce6]">{c.text}</a> : c.text}</li>)}
          </ol>
        </div>
      </div>
    </div>
  </section>;
}
