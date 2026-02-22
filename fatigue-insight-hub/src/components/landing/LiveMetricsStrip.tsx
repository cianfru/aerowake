import { useEffect, useRef, useState } from 'react';
import { ScrollReveal } from './ScrollReveal';

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  decimals?: number;
  label: string;
  started: boolean;
}

function AnimatedCounter({ target, suffix = '', decimals = 0, label, started }: AnimatedCounterProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!started) return;

    const duration = 2000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [started, target]);

  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return (
    <div className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-5 backdrop-blur-sm">
      <span className="text-3xl font-bold tracking-tight text-white md:text-4xl">
        {display}
        {suffix}
      </span>
      <span className="mt-1.5 text-xs text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function LiveMetricsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative bg-[#000408] py-16 md:py-20">
      <div ref={ref} className="mx-auto max-w-5xl px-6">
        <ScrollReveal>
          <p className="mb-8 text-center text-xs uppercase tracking-[0.2em] text-white/30 font-mono">
            February 2026 &middot; Sample Analysis
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <ScrollReveal delay={0}>
            <AnimatedCounter target={14} label="Duties Analyzed" started={started} />
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <AnimatedCounter target={7} label="Critical Events" started={started} />
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <AnimatedCounter target={44.8} suffix="%" decimals={1} label="Lowest Performance" started={started} />
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <AnimatedCounter target={8.0} suffix="h" decimals={1} label="Peak Sleep Debt" started={started} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
