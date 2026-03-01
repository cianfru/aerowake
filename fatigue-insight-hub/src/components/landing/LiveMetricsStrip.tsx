import { Calendar, Users, Shield } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const pillars = [
  {
    icon: Calendar,
    label: 'Rolling year view',
    detail: 'Map every roster across 12 months of fatigue history',
  },
  {
    icon: Users,
    label: 'Fleet-wide comparison',
    detail: 'Benchmark your fatigue profile against colleagues and fleet averages',
  },
  {
    icon: Shield,
    label: 'SMS-ready output',
    detail: 'Professional fatigue reports with impairment equivalences and mitigations',
  },
];

export function LiveMetricsStrip() {
  return (
    <section className="relative bg-[#000408]">
      {/* Top separator */}
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10 md:py-14 md:px-10 lg:px-16">
        <ScrollReveal>
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-white/50" strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-white/80 tracking-wide block mb-1">
                      {p.label}
                    </span>
                    <span className="text-[11px] leading-[1.6] text-white/50 font-light">
                      {p.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>

      {/* Bottom separator */}
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>
    </section>
  );
}
