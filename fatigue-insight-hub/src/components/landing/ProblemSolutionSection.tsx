import { Activity, Moon, Clock, FileText, Users, Brain, CalendarRange, BarChart3 } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const capabilities = [
  {
    icon: Brain,
    title: 'Biomathematical Modeling',
    desc: 'Borbély Two-Process Model predicts cognitive performance from sleep history, circadian phase, and time awake.',
    accent: 'hsl(199, 89%, 48%)',
  },
  {
    icon: Moon,
    title: 'Sleep Estimation',
    desc: 'Automatically estimates sleep quality and duration based on duty timing, rest opportunities, and environment.',
    accent: 'hsl(230, 70%, 60%)',
  },
  {
    icon: Clock,
    title: 'Circadian Tracking',
    desc: 'Tracks your body clock across time zones. Understands jet lag, WOCL exposure, and acclimatization state.',
    accent: 'hsl(280, 60%, 55%)',
  },
  {
    icon: Activity,
    title: 'Per-Phase Scoring',
    desc: 'Performance scores at every flight phase — from departure through cruise to approach and landing.',
    accent: 'hsl(30, 90%, 55%)',
  },
  {
    icon: Users,
    title: 'Fleet & Peer Comparison',
    desc: 'Compare your fatigue profile against colleagues, fleet averages, and company-wide trends to see where you stand.',
    accent: 'hsl(160, 70%, 45%)',
  },
  {
    icon: CalendarRange,
    title: 'Multi-Month Memory',
    desc: 'Persistent roster history tracks your fatigue patterns over months. Sleep debt, cumulative trends, and long-term risk — nothing is forgotten.',
    accent: 'hsl(199, 89%, 48%)',
  },
  {
    icon: FileText,
    title: 'SMS-Ready Reports',
    desc: 'Generate professional fatigue assessment reports with impairment equivalences and mitigation recommendations.',
    accent: 'hsl(45, 90%, 55%)',
  },
  {
    icon: BarChart3,
    title: '12-Month Dashboard',
    desc: 'Map every roster across a rolling year. Fatigue trends, duty hours, sleep debt evolution, and training ratios — the full picture at a glance.',
    accent: 'hsl(340, 70%, 55%)',
  },
];

export function ProblemSolutionSection() {
  return (
    <section className="relative bg-[#000408] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <ScrollReveal>
          <div className="mb-14 max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-8 bg-white/15" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/50">Capabilities</span>
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight text-white md:text-4xl">
              What the model captures.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.7] text-white/60 font-light">
              Going beyond regulatory duty limits to model the biological
              factors that actually determine how alert you are in the cockpit.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid gap-3 md:grid-cols-4">
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <ScrollReveal key={i} delay={i * 80}>
                <div
                  className="group relative rounded-xl p-6 md:p-7 h-full transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 cursor-default border border-white/[0.08] hover:border-white/[0.15] backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  }}
                >
                  {/* Icon with centered accent glow */}
                  <div className="relative mb-4 w-fit">
                    <Icon
                      className="relative z-10 h-5 w-5 text-white/40 transition-all duration-500 group-hover:text-white/90"
                      strokeWidth={1.5}
                    />
                    <div
                      className="absolute -inset-3 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-50 blur-lg"
                      style={{ backgroundColor: cap.accent }}
                    />
                  </div>

                  <h3 className="text-[13px] font-semibold text-white/90 tracking-wide mb-2 transition-colors duration-300 group-hover:text-white">
                    {cap.title}
                  </h3>
                  <p className="text-[12px] leading-[1.7] text-white/50 font-light transition-colors duration-300 group-hover:text-white/65">
                    {cap.desc}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
