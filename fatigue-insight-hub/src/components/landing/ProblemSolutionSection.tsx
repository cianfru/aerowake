import { XCircle, CheckCircle2 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

export function ProblemSolutionSection() {
  return (
    <section className="relative bg-[#000408] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <p className="mb-10 text-center text-xs uppercase tracking-[0.2em] text-white/30 font-mono">
            The Problem &middot; The Solution
          </p>
        </ScrollReveal>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          {/* Problem */}
          <ScrollReveal delay={0}>
            <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-6 md:p-8">
              <h3 className="text-xl font-bold text-white md:text-2xl">
                Your roster says you're legal.
                <br />
                <span className="text-red-400">Your biology disagrees.</span>
              </h3>
              <div className="mt-6 space-y-4">
                {[
                  'FTL limits are based on clock hours, not human biology',
                  'A pilot can be fully compliant yet cognitively impaired',
                  'No objective way to measure cumulative fatigue',
                ].map((text, i) => (
                  <div key={i} className="flex gap-3">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400/70" />
                    <p className="text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Solution */}
          <ScrollReveal delay={150}>
            <div className="rounded-2xl border border-green-500/10 bg-green-500/[0.03] p-6 md:p-8">
              <h3 className="text-xl font-bold text-white md:text-2xl">
                Aerowake quantifies
                <br />
                <span className="text-green-400">what you actually feel.</span>
              </h3>
              <div className="mt-6 space-y-4">
                {[
                  'Minute-by-minute performance scores from biomathematical models',
                  'Circadian phase tracking across time zones',
                  'SMS-ready fatigue reports backed by peer-reviewed science',
                ].map((text, i) => (
                  <div key={i} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400/70" />
                    <p className="text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
