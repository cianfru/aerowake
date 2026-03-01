import { ScrollReveal } from './ScrollReveal';

const steps = [
  {
    num: '01',
    title: 'Upload your roster',
    desc: 'Import your monthly duty schedule as a PDF. The parser extracts duties, sectors, and rest periods automatically.',
  },
  {
    num: '02',
    title: 'Sleep is estimated',
    desc: 'Based on your duty times, rest opportunities, and environment, the model generates realistic sleep estimates.',
  },
  {
    num: '03',
    title: 'Fatigue is modeled',
    desc: 'The Two-Process Model runs minute-by-minute, computing sleep pressure, circadian drive, and their interaction.',
  },
  {
    num: '04',
    title: 'Results are visualised',
    desc: 'Interactive chronograms, performance timelines, and per-flight-phase scores — everything at a glance.',
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative bg-[#000408] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <ScrollReveal>
          <div className="mb-16 max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-8 bg-white/10" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/40">Workflow</span>
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight text-white md:text-4xl">
              Roster to insight in seconds.
            </h2>
          </div>
        </ScrollReveal>

        {/* Steps — numbered editorial layout */}
        <div className="grid gap-0 md:grid-cols-4">
          {steps.map((step, i) => (
            <ScrollReveal key={i} delay={i * 120}>
              <div className="group relative border-l border-white/[0.06] pl-6 py-6 md:py-0 md:pb-0">
                {/* Active dot on the border */}
                <div className="absolute left-[-3px] top-8 md:top-0 h-1.5 w-1.5 rounded-full bg-white/10 transition-colors duration-300 group-hover:bg-[hsl(199,89%,48%)]/50" />

                <span className="text-[10px] font-mono text-white/30 tracking-wider mb-3 block">
                  {step.num}
                </span>
                <h3 className="text-[14px] font-medium text-white/80 mb-2 tracking-wide">
                  {step.title}
                </h3>
                <p className="text-[12px] leading-[1.7] text-white/45 font-light pr-4">
                  {step.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
