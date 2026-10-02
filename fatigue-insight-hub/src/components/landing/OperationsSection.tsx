import { BedDouble, ClipboardList, Scale, UserCheck, type LucideIcon } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { NON_AFFILIATION_NOTE } from './landingData';

const POINTS: { icon: LucideIcon; title: string; body: string; ref: string }[] = [
  { icon: BedDouble, title: 'Plan and use your rest', body: 'Crew are asked to make optimum use of rest opportunities and to plan and use rest periods properly. Aerowake shows where that planning matters most.', ref: 'ORO.FTL.115' },
  { icon: Scale, title: 'Your operator’s scheme comes first', body: 'Checks reference EASA flight-time limitations on the duties you supply. Your operator’s approved flight time specification scheme takes precedence.', ref: 'ORO.FTL.125 · .210 · .235' },
  { icon: ClipboardList, title: 'Reporting through your FRM', body: 'When a duty is worth reporting, keep a clear, factual summary that fits your operator’s fatigue risk management and reporting process. Nothing goes to your operator unless you send it.', ref: 'ORO.FTL.120' },
  { icon: UserCheck, title: 'Never a fitness-for-duty decision', body: 'Predictions describe a group-average pilot. Your own assessment and your operator’s procedures decide whether you are fit to fly.', ref: 'Your judgement first' },
];

export function OperationsSection() {
  return <section id="operations" aria-labelledby="operations-title" className="landing-section bg-[#f8fbfd]">
    <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
      <ScrollReveal className="grid gap-6 lg:grid-cols-[.82fr_1.18fr] lg:gap-16">
        <div className="space-y-5">
          <p className="landing-eyebrow">Operations</p>
          <h2 id="operations-title" className="landing-h2">Designed to work alongside your operator.</h2>
        </div>
        <p className="self-end text-base leading-7 text-[#425d73] lg:text-lg lg:leading-8">Aerowake is a planning aid for the rest you are already responsible for. It follows the same references your operator works with and keeps every assumption in view.</p>
      </ScrollReveal>

      <ScrollReveal delay={60}>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body, ref }) => <li key={title} className="landing-card flex gap-4 p-6">
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#087478]" strokeWidth={1.5} />
            <div className="min-w-0">
              <h3 className="font-medium text-[#142e45]">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[#425d73]">{body}</p>
              <p className="mt-3 font-mono text-[11px] tracking-wide text-[#526579]">{ref}</p>
            </div>
          </li>)}
        </ul>
        <div className="mt-6 rounded-2xl border border-dashed border-[#b5cbd6] px-6 py-5 text-sm leading-6 text-[#425d73]">
          <p className="max-w-3xl">{NON_AFFILIATION_NOTE}</p>
        </div>
      </ScrollReveal>
    </div>
  </section>;
}
