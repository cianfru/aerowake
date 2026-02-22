import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  LineChart,
  AreaChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { ScrollReveal } from './ScrollReveal';

// --- Performance Curve Preview (auto-animating) ---
function PerformanceCurvePreview() {
  const [wakeHour, setWakeHour] = useState(6);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const animate = (time: number) => {
      const elapsed = (time - startRef.current) / 1000;
      // Oscillate wakeHour between 5 and 12 over 20s
      const t = (elapsed % 20) / 20;
      const eased = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI);
      setWakeHour(5 + eased * 7);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const data = useMemo(() => {
    const S_MAX = 0.95;
    const TAU_INCREASE = 18.2;
    const MESOR = 0.5;
    const AMPLITUDE = 0.35;
    const ACROPHASE = 17;
    const FLOOR = 20;
    const S0 = 0.15;

    const points: { hour: number; performance: number; riskColor: string }[] = [];
    for (let h = 0; h <= 20; h++) {
      const actualHour = (Math.round(wakeHour) + h) % 24;
      const S = S_MAX - (S_MAX - S0) * Math.exp(-h / TAU_INCREASE);
      const S_alert = 1 - S;
      const angle = (2 * Math.PI * (actualHour - ACROPHASE)) / 24;
      const C = MESOR + AMPLITUDE * Math.cos(angle);
      const C_alert = (C - (MESOR - AMPLITUDE)) / (2 * AMPLITUDE);
      const baseAlert = S_alert * 0.6 + C_alert * 0.4;
      const perf = FLOOR + baseAlert * (100 - FLOOR);

      let riskColor = '#22c55e';
      if (perf < 55) riskColor = '#ef4444';
      else if (perf < 65) riskColor = '#f97316';
      else if (perf < 75) riskColor = '#eab308';

      points.push({ hour: h, performance: Math.round(perf), riskColor });
    }
    return points;
  }, [wakeHour]);

  return (
    <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-3 left-4 z-10">
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-mono">Performance Score vs. Hours Awake</p>
        <p className="text-xs text-white/50 mt-0.5">Two-Process Model (Borbely)</p>
      </div>
      <div className="h-[220px] md:h-[260px] mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              tickFormatter={(h) => `${h}h`}
            />
            <YAxis
              domain={[20, 100]}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine y={55} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
            <ReferenceLine y={75} stroke="rgba(34,197,94,0.3)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="performance"
              fill="url(#perfGrad)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="performance"
              stroke="hsl(199, 89%, 48%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Circadian Wave Preview (auto-animating) ---
function CircadianWavePreview() {
  const [phaseShift, setPhaseShift] = useState(0);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const animate = (time: number) => {
      const elapsed = (time - startRef.current) / 1000;
      // Oscillate phaseShift between -6 and +6 over 30s
      const t = (elapsed % 30) / 30;
      const shift = 6 * Math.sin(t * 2 * Math.PI);
      setPhaseShift(shift);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const data = useMemo(() => {
    const MESOR = 0.5;
    const AMPLITUDE = 0.35;
    const ACROPHASE = 17;

    const points: { hour: number; alertness: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const effectiveHour = (h - phaseShift + 24) % 24;
      const angle = (2 * Math.PI * (effectiveHour - ACROPHASE)) / 24;
      const C = MESOR + AMPLITUDE * Math.cos(angle);
      const normalizedC = (C - (MESOR - AMPLITUDE)) / (2 * AMPLITUDE);
      points.push({ hour: h, alertness: Math.round(normalizedC * 100) });
    }
    return points;
  }, [phaseShift]);

  const shiftLabel = phaseShift >= 0 ? `+${phaseShift.toFixed(1)}h East` : `${phaseShift.toFixed(1)}h West`;

  return (
    <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-3 left-4 z-10">
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-mono">Circadian Rhythm (Process C)</p>
        <p className="text-xs text-white/50 mt-0.5">
          Jet Lag Shift: <span className="text-[hsl(199,89%,60%)]">{shiftLabel}</span>
        </p>
      </div>
      <div className="h-[220px] md:h-[260px] mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="circGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(280, 65%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(280, 65%, 60%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              tickFormatter={(h) => `${h.toString().padStart(2, '0')}:00`}
              interval={5}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceArea x1={2} x2={6} fill="rgba(239,68,68,0.08)" />
            <ReferenceArea x1={15} x2={19} fill="rgba(34,197,94,0.06)" />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="alertness"
              stroke="hsl(280, 65%, 60%)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Sleep Debt Preview (progressive reveal) ---
function SleepDebtPreview() {
  const [visibleCount, setVisibleCount] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const hasStarted = useRef(false);

  // Generate synthetic sleep debt data
  const fullData = useMemo(() => {
    const points: { day: number; debt: number; isDuty: boolean }[] = [];
    let debt = 0;

    // Simulate 28 days: duties on days 3,7,8,9,11,12,13,15,16,21,23,24,25,27
    const dutyDays = new Set([3, 7, 8, 9, 11, 12, 13, 15, 16, 21, 23, 24, 25, 27]);

    for (let d = 1; d <= 28; d++) {
      if (dutyDays.has(d)) {
        debt += 1.5 + Math.random() * 2.5;
      } else {
        debt = Math.max(0, debt * 0.85);
      }
      debt = Math.min(debt, 12);
      points.push({ day: d, debt: Math.round(debt * 10) / 10, isDuty: dutyDays.has(d) });
    }
    return points;
  }, []);

  const startAnimation = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startRef.current = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startRef.current) / 1000;
      const count = Math.min(Math.floor(elapsed * 3.5), fullData.length);
      setVisibleCount(count);
      if (count < fullData.length) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [fullData.length]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [startAnimation]);

  const data = fullData.slice(0, visibleCount);

  return (
    <div ref={sectionRef} className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm overflow-hidden">
      <div className="absolute top-3 left-4 z-10">
        <p className="text-[10px] uppercase tracking-wider text-white/30 font-mono">Cumulative Sleep Debt</p>
        <p className="text-xs text-white/50 mt-0.5">28-Day Roster Pattern</p>
      </div>
      <div className="h-[220px] md:h-[260px] mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              tickFormatter={(d) => `D${d}`}
              interval={4}
            />
            <YAxis
              domain={[0, 12]}
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.2)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <ReferenceLine y={6} stroke="rgba(249,115,22,0.3)" strokeDasharray="3 3" />
            <ReferenceLine y={10} stroke="rgba(239,68,68,0.3)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="debt"
              fill="url(#debtGrad)"
              stroke="#f97316"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Main Section ---
export function DataShowcaseSection() {
  return (
    <section className="relative bg-[#000408] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              The Science in Action
            </h2>
            <p className="mt-3 text-sm text-white/40 max-w-lg mx-auto">
              Real biomathematical models running live. These curves predict cognitive
              performance degradation before it happens.
            </p>
          </div>
        </ScrollReveal>

        {/* 2-column top row */}
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <ScrollReveal delay={0}>
            <PerformanceCurvePreview />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <CircadianWavePreview />
          </ScrollReveal>
        </div>

        {/* Full-width bottom row */}
        <div className="mt-4 md:mt-6">
          <ScrollReveal delay={300}>
            <SleepDebtPreview />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
