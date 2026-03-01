import { ScrollReveal } from './ScrollReveal';

// ─── Screenshot with fading edges ────────────────────────
function FadedScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg">
      <img src={src} alt={alt} className="w-full h-auto block" loading="lazy" />
      {/* Horizontal edge fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #000408 0%, transparent 8%, transparent 92%, #000408 100%)',
        }}
      />
      {/* Vertical edge fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, #000408 0%, transparent 12%, transparent 88%, #000408 100%)',
        }}
      />
      {/* Corner reinforcement */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at top left, #000408 0%, transparent 30%),
            radial-gradient(ellipse at top right, #000408 0%, transparent 30%),
            radial-gradient(ellipse at bottom left, #000408 0%, transparent 30%),
            radial-gradient(ellipse at bottom right, #000408 0%, transparent 30%)
          `,
        }}
      />
    </div>
  );
}

// ─── Feature showcase items ──────────────────────────────
const features = [
  {
    src: '/screenshots/chronogram.png',
    alt: 'Aerowake Chronogram',
    title: 'Your roster, visualised.',
    description:
      'See every duty, sleep block, and circadian low window mapped across your schedule on a 24-hour timeline. Colour-coded risk levels, flight numbers, and sleep annotations — the full picture of your operational life at a glance.',
    align: 'right' as const,
  },
  {
    src: '/screenshots/safte-view.png',
    alt: 'Aerowake SAFTE View',
    title: 'Continuous performance tracking.',
    description:
      'Monitor your cognitive performance and sleep reservoir in real time across your entire roster. Hover any point to see the exact Borbély model breakdown — homeostatic pressure, circadian drive, time on task — and understand precisely why your alertness changes.',
    align: 'left' as const,
  },
  {
    src: '/screenshots/duty-details.png',
    alt: 'Aerowake Duty Details',
    title: 'Every duty, fully analysed.',
    description:
      'Drill into any single duty for a complete fatigue assessment. Per-flight performance scores, KSS and Samn-Perelli ratings, FDP utilisation, prior sleep quality, and a four-factor decomposition showing exactly what drove your fatigue — sleep pressure, circadian phase, time on duty, or cabin altitude.',
    align: 'right' as const,
  },
  {
    src: '/screenshots/sleep-debt.png',
    alt: 'Aerowake Sleep Debt Trend',
    title: 'Track your sleep debt over time.',
    description:
      'Watch how fatigue accumulates across consecutive duties and recovers during rest periods. Peak debt, current debt, recovery rate — all mapped across your roster so you can see the long-term effects of your schedule, not just single-duty snapshots.',
    align: 'left' as const,
  },
  {
    src: '/screenshots/fatigue-report.png',
    alt: 'Aerowake Fatigue Report',
    title: 'SMS-ready fatigue reports.',
    description:
      'Generate professional fatigue assessment reports with narrative analysis, performance trajectory charts, impairment equivalences, and actionable mitigation recommendations. Ready for Safety Management System submissions, with a one-click PDF export.',
    align: 'right' as const,
  },
];

// ─── Main Section ─────────────────────────────────────────
export function AppShowcaseSection() {
  return (
    <section className="relative bg-[#000408] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        {/* Section header */}
        <ScrollReveal>
          <div className="mb-20 max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-8 bg-white/15" />
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/50">
                Inside the tool
              </span>
            </div>
            <h2 className="font-serif text-3xl font-light tracking-tight text-white md:text-4xl">
              Everything you need to see.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-white/60 font-light">
              From roster-wide timelines to single-duty breakdowns, sleep debt
              tracking to SMS-ready reports — every layer of your performance
              analysis, in one place.
            </p>
          </div>
        </ScrollReveal>

        {/* Feature rows — alternating text/image layout */}
        <div className="space-y-24 md:space-y-32">
          {features.map((feature, i) => (
            <ScrollReveal key={i} delay={100}>
              <div
                className={`flex flex-col gap-8 md:gap-12 md:items-center ${
                  feature.align === 'left'
                    ? 'md:flex-row'
                    : 'md:flex-row-reverse'
                }`}
              >
                {/* Screenshot */}
                <div className="md:w-3/5 flex-shrink-0">
                  <FadedScreenshot src={feature.src} alt={feature.alt} />
                </div>

                {/* Text */}
                <div className="md:w-2/5">
                  <h3 className="font-serif text-2xl font-light tracking-tight text-white md:text-3xl mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-[14px] leading-[1.8] text-white/55 font-light">
                    {feature.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
