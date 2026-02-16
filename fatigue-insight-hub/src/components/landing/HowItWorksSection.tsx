import { FileText, Brain, Zap, BarChart3, Eye } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const steps = [
  { icon: FileText, label: 'Upload Roster', desc: 'Import your monthly duty schedule' },
  { icon: Brain, label: 'Sleep Estimation', desc: 'AI models your sleep opportunities' },
  { icon: Zap, label: 'Bio-Math Engine', desc: 'Two-process model calculates fatigue' },
  { icon: BarChart3, label: 'Performance Scores', desc: 'Minute-by-minute cognitive scores' },
  { icon: Eye, label: 'Visual Insights', desc: 'Timelines, heatmaps, and reports' },
];

export function HowItWorksSection() {
  return (
    <section className="relative bg-[#000408] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-sm text-white/40">
              From roster upload to actionable fatigue insights in five steps.
            </p>
          </div>
        </ScrollReveal>

        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <ScrollReveal key={i} delay={i * 100} className="flex-1">
                <div className="group relative flex flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-center transition-all duration-300 hover:border-white/15 hover:bg-white/[0.04] h-full">
                  {/* Step number */}
                  <span className="absolute -top-2.5 left-4 rounded-full bg-[#000408] px-2 text-[10px] font-mono text-white/25 border border-white/[0.08]">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05]">
                    <Icon className="h-5 w-5 text-[hsl(199,89%,48%)]" />
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-white">{step.label}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/35">{step.desc}</p>

                  {/* Connector arrow (hidden on mobile, hidden on last) */}
                  {i < steps.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-white/15 md:block">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
