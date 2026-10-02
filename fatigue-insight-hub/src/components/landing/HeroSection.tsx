import { Link } from 'react-router-dom';
import { ArrowRight, Moon, NotebookPen, Plane, type LucideIcon } from 'lucide-react';
import { LandingGlobe } from './LandingGlobe';
import { HERO_COPY } from './landingData';

const DUTY_FRAME: { icon: LucideIcon; label: string; short: string }[] = [
  { icon: Moon, label: 'Sleep and recovery', short: 'Sleep & recovery' },
  { icon: Plane, label: 'Duty timing and body clock', short: 'Duty timing' },
  { icon: NotebookPen, label: 'How it actually went', short: 'Your experience' },
];

export function HeroSection({ onEnter }: { onEnter: () => void }) {
  return <section id="top" aria-labelledby="hero-title" className="landing-hero relative isolate overflow-hidden pt-24 md:pt-32">
    <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 pb-12 md:px-10 md:pb-14 lg:grid-cols-[1.08fr_1fr] lg:gap-8 lg:px-16 lg:pb-24">
      <div className="relative z-10 max-w-xl">
        <p className="landing-eyebrow mb-5">{HERO_COPY.eyebrow.split(' · ').map((part, i) => <span key={part} className={i ? 'block sm:inline' : undefined}>{i > 0 && <span aria-hidden="true" className="hidden sm:inline"> · </span>}{part}</span>)}</p>
        <h1 id="hero-title" className="landing-display text-balance text-[clamp(2.6rem,5.8vw,4.6rem)]">{HERO_COPY.headline}</h1>
        <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-7 text-[#425d73] md:text-lg md:leading-8">{HERO_COPY.subline}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" onClick={onEnter} className="landing-cta-primary w-full sm:w-auto">Analyse my roster <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
          <Link to="/report" className="landing-cta-secondary w-full sm:w-auto">Log how a duty went</Link>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#526579]">Start without an account. No roster file? Enter your recent duties instead.</p>
      </div>

      <div className="relative mx-auto w-full max-w-[18.75rem] sm:mb-10 sm:max-w-md lg:mb-12 lg:max-w-[31rem] lg:justify-self-end">
        <div className="landing-orbit"><LandingGlobe /></div>
        <div className="landing-glass absolute -bottom-10 left-0 hidden w-[min(18rem,80%)] p-5 sm:block lg:-bottom-12 lg:-left-6 xl:-left-10">
          <p className="mb-3.5 text-sm font-semibold text-[#142e45]">Every duty has a before and after.</p>
          <ul className="space-y-2.5 text-sm text-[#425d73]">
            {DUTY_FRAME.map(({ icon: Icon, label }) => <li key={label} className="flex items-center gap-3"><Icon aria-hidden="true" className="h-4 w-4 text-[#087478]" />{label}</li>)}
          </ul>
        </div>
        <ul aria-label="Every duty has a before and after" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:hidden">
          {DUTY_FRAME.map(({ icon: Icon, short }) => <li key={short} className="flex items-center gap-1.5 text-xs font-medium text-[#425d73]"><Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#087478]" />{short}</li>)}
        </ul>
      </div>
    </div>
  </section>;
}
