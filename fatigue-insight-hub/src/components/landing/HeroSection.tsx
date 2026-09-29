import { Link } from 'react-router-dom';
import { ArrowDown, FileText, Moon, Plane } from 'lucide-react';
import { LandingGlobe } from './LandingGlobe';

interface HeroSectionProps {
  onScrollToContent: () => void;
  onEnter: () => void;
}

export function HeroSection({ onScrollToContent, onEnter }: HeroSectionProps) {
  return <section className="relative overflow-hidden border-b border-[#c6dbe6] bg-[#edf5fa] pt-28 md:pt-36">
    <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-6 pb-14 md:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-0 lg:px-16 lg:pb-20">
      <div className="relative z-10 max-w-xl">
        <p className="mb-6 flex items-center gap-2 text-sm font-medium text-[#087478]"><Plane className="h-4 w-4" /> A clearer picture of pilot fatigue</p>
        <h1 className="font-serif text-[clamp(3.2rem,5.8vw,5.1rem)] leading-[1.04] tracking-[-0.025em] text-[#142e45]">Understand your roster.<br />Report fatigue clearly.</h1>
        <p className="mt-7 max-w-md text-lg leading-8 text-[#425d73]">See where your duties may become demanding. Add the sleep you actually had, capture how you felt, and build a report that tells the whole story.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={onEnter} className="rounded-full bg-[#175779] px-7 py-3.5 text-sm font-semibold text-slate-50 transition-colors hover:bg-[#123e58]">Analyse a roster</button>
          <Link to="/report" className="rounded-full border border-[#8ca9ba] bg-[#f8fbfd] px-6 py-3.5 text-sm font-semibold text-[#173d57] transition-colors hover:bg-[#dcebf3]">Create a fatigue report</Link>
        </div>
        <p className="mt-4 text-sm text-[#425d73]">Start without an account. No roster? Enter your recent days.</p>
      </div>
      <div className="relative mx-auto w-full max-w-lg py-4 lg:py-12">
        <LandingGlobe />
        <div className="relative -mt-14 ml-auto max-w-xs rounded-2xl border border-[#b9d4df] bg-[#f8fbfd]/95 p-5 shadow-[0_14px_40px_-24px_#285c76]">
          <p className="mb-4 text-sm font-semibold text-[#142e45]">Every duty has a before and after.</p>
          <div className="space-y-3 text-sm text-[#425d73]">
            <p className="flex items-center gap-3"><Moon className="h-4 w-4 text-[#087478]" /> Sleep and recovery</p>
            <p className="flex items-center gap-3"><Plane className="h-4 w-4 text-[#175779]" /> Duty timing and workload</p>
            <p className="flex items-center gap-3"><FileText className="h-4 w-4 text-[#9c570a]" /> Your own experience</p>
          </div>
        </div>
      </div>
    </div>
    <div className="border-t border-[#c6dbe6] bg-[#e2eef5]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm text-[#425d73] md:px-10 lg:px-16">
        <p>Published science. Visible assumptions. Your judgment.</p>
        <button onClick={onScrollToContent} className="flex items-center gap-2 font-medium text-[#175779]">Explore the workflow <ArrowDown className="h-4 w-4" /></button>
      </div>
    </div>
  </section>;
}
