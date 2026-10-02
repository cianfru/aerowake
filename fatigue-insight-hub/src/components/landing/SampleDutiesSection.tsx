import { kssLabel } from '@/lib/risk-scale';
import { ScrollReveal } from './ScrollReveal';
import { KssScale } from './KssScale';
import { BandTag } from './BandTag';
import { formatKssValue, roundKss } from './landingKss';
import { formatDay, formatRoute, formatWeekday } from './landingFormat';
import { TOUR_BASE, TOUR_DUTIES } from './tourData';

/** One trip from the illustrative roster: out to London, back overnight, then an early Bangkok departure. */
const TRIP = ['2026-10-03', '2026-10-05', '2026-10-07'];
const DUTIES = TOUR_DUTIES.filter((d) => TRIP.includes(d.date));
const FOCUS = DUTIES[DUTIES.length - 1];

/** Illustrative data stays legible on phones and never impersonates a pilot record. */
export function SampleDutiesSection() {
  return <section id="sample-duties" aria-labelledby="sample-title" className="landing-section bg-[#f8fbfd]">
    <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:px-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-16 lg:px-16">
      <ScrollReveal className="max-w-md space-y-5">
        <p className="landing-eyebrow">From roster to rest plan</p>
        <h2 id="sample-title" className="landing-h2">See the duties that deserve a closer look.</h2>
        <p className="text-base leading-7 text-[#425d73]">Every duty gets a predicted peak sleepiness, the timing behind it and the assumptions it rests on, so you can plan rest where it matters most.</p>
        <p className="text-sm leading-6 text-[#526579]">KSS runs from 1 (extremely alert) to 9 (very sleepy, fighting sleep). Predictions describe a group-average pilot: they support your planning and never decide whether you are fit to fly.</p>
      </ScrollReveal>

      <ScrollReveal delay={80}>
        <figure className="landing-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c566b] bg-[linear-gradient(110deg,#17384f_30%,#235669)] px-5 py-4 sm:px-6">
            <span className="text-sm font-medium text-[#f4f8fa]">Your roster at a glance</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#c9dde6]">Illustrative data</span>
          </div>
          <p className="border-b border-[#dbe7ed] bg-[#f3f8fa] px-5 py-2.5 text-xs text-[#526579] sm:px-6">Times in home-base time, {TOUR_BASE.code} ({TOUR_BASE.offset}) · headline figure is the duty's peak</p>
          <ul className="divide-y divide-[#dbe7ed] px-5 sm:px-6">
            {DUTIES.map((duty) => <li key={duty.date} className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase tracking-wide text-[#526579]">{formatDay(duty.date)}</p>
                  <p className="mt-1 text-lg font-medium text-[#142e45]">{formatRoute(duty.route)}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#425d73]"><time>{duty.report}</time>–<time>{duty.release}</time></p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-2xl leading-none text-[#142e45]"><span className="sr-only">Peak </span>{formatKssValue(duty.peakKss)}<span className="ml-1 text-xs text-[#526579]">KSS</span></p>
                  <BandTag kss={duty.peakKss} className="mt-2" />
                </div>
              </div>
              {duty.reason && <p className="mt-2.5 text-sm leading-6 text-[#425d73]"><span aria-hidden="true" className="mr-2 text-[#8aa0b2]">—</span>{duty.reason}</p>}
              <div className="mt-3 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_12.5rem] sm:items-center sm:gap-5">
                <KssScale kss={duty.peakKss} />
                <p className="text-xs text-[#526579] sm:text-right">{kssLabel(roundKss(duty.peakKss))}</p>
              </div>
            </li>)}
          </ul>
          <figcaption className="border-t border-[#dbe7ed] bg-[#edf3f6] px-5 py-4 text-sm leading-6 text-[#425d73] sm:px-6">
            <span className="font-semibold text-[#142e45]">{formatWeekday(FOCUS.date)} crosses your body-clock low.</span>{' '}
            Report at {FOCUS.report} home-base time runs through 02:00–05:59. Worth planning rest before it, and noting how you felt afterwards.
          </figcaption>
        </figure>
        <p className="mt-3 text-xs leading-5 text-[#526579]">Scale ticks mark where the higher bands begin: 5.5, 6.5, 7.5 and 8.5. A synthetic roster run through the current model; no real pilot or schedule.</p>
      </ScrollReveal>
    </div>
  </section>;
}
