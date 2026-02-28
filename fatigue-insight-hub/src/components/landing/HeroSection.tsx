import { useRef } from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';
import { LandingGlobe } from './LandingGlobe';
import { useScrollProgress } from './useScrollProgress';

interface HeroSectionProps {
  onScrollToContent: () => void;
}

export function HeroSection({ onScrollToContent }: HeroSectionProps) {
  const heroRef = useRef<HTMLElement>(null);
  const progress = useScrollProgress(heroRef);

  // Fade out hero content as user scrolls past (progress ~0.5 = top of page)
  const scrollFade = Math.max(0, Math.min(1, (progress - 0.5) * 4));
  const contentOpacity = 1 - scrollFade;
  const contentTranslate = scrollFade * 60;

  return (
    <section ref={heroRef} className="relative h-screen overflow-hidden bg-[#000408]">
      {/* Mapbox Globe Background — z-0 */}
      <LandingGlobe />

      {/* Gradient overlays — z-[1], between globe and content */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(0,4,8,0.88) 0%, rgba(0,4,8,0.4) 45%, rgba(0,4,8,0.1) 70%, rgba(0,4,8,0.2) 100%)',
        }}
      />
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,4,8,0.3) 0%, transparent 15%, transparent 75%, #000408 100%)',
        }}
      />

      {/* Hero Content — centered, in front of globe */}
      <div
        className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentTranslate}px)`,
        }}
      >
        <div className="max-w-3xl">
          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Landing alertness,{' '}
            <span className="bg-gradient-to-r from-[hsl(199,89%,48%)] to-[hsl(199,89%,68%)] bg-clip-text text-transparent">
              predicted.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/45 md:text-lg">
            Biomathematical fatigue modeling that quantifies pilot performance
            from takeoff to touchdown.
          </p>

          {/* Science credibility */}
          <div className="mx-auto mt-5 flex items-center justify-center gap-2.5">
            <BookOpen className="h-3.5 w-3.5 text-[hsl(199,89%,48%)]/60" />
            <span className="text-xs text-white/35 tracking-wide">
              Built on <span className="text-white/55 font-medium">56 peer-reviewed studies</span> in sleep science and human performance
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onScrollToContent}
              className="rounded-lg bg-[hsl(199,89%,48%)] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-[hsl(199,89%,42%)] hover:shadow-[0_0_30px_rgba(14,165,233,0.3)] active:scale-[0.98]"
            >
              Explore the Science
            </button>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium tracking-wider text-white/40 uppercase backdrop-blur-sm">
              EASA ORO.FTL Compliant
            </span>
          </div>
        </div>

        {/* Bottom feature bullets */}
        <div className="absolute bottom-20 left-0 right-0 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
          {[
            'Two-Process Model',
            'Circadian Phase Tracking',
            'Sleep Debt Analysis',
            'SMS-Ready Reports',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[hsl(199,89%,48%)]/50" />
              <span className="text-[11px] text-white/25 tracking-wide">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={onScrollToContent}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 transition-colors hover:text-white/50"
        style={{ opacity: contentOpacity }}
      >
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </button>
    </section>
  );
}
