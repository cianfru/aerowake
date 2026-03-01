import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { LandingGlobe } from './LandingGlobe';
import { useScrollProgress } from './useScrollProgress';

interface HeroSectionProps {
  onScrollToContent: () => void;
}

export function HeroSection({ onScrollToContent }: HeroSectionProps) {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const progress = useScrollProgress(heroRef);

  const scrollFade = Math.max(0, Math.min(1, (progress - 0.5) * 4));
  const contentOpacity = 1 - scrollFade;
  const contentTranslate = scrollFade * 60;

  return (
    <section ref={heroRef} className="relative h-screen overflow-hidden bg-[#000408]">
      {/* Mapbox Globe Background */}
      <LandingGlobe />

      {/* Gradient overlays */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `
            linear-gradient(135deg, rgba(0,4,8,0.92) 0%, rgba(0,4,8,0.65) 40%, rgba(0,4,8,0.15) 65%, rgba(0,4,8,0.25) 100%)
          `,
        }}
      />
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,4,8,0.2) 0%, transparent 20%, transparent 70%, #000408 100%)',
        }}
      />

      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* Hero Content — left-aligned editorial layout */}
      <div
        className="relative z-10 flex h-full items-end pb-32 md:items-center md:pb-0"
        style={{
          opacity: contentOpacity,
          transform: `translateY(${contentTranslate}px)`,
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-6 md:px-10 lg:px-16">
          <div className="max-w-2xl">
            {/* Overline */}
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px w-8 bg-[hsl(199,89%,48%)]/40" />
              <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-[hsl(199,89%,48%)]/70">
                Fatigue Risk Management
              </span>
            </div>

            {/* Headline — large, confident, clean */}
            <h1 className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-white">
              Know your fatigue
              <br />
              <span className="text-white/65">before you fly.</span>
            </h1>

            {/* Body copy — warm, supportive, not confrontational */}
            <p className="mt-6 max-w-md text-[15px] leading-[1.7] text-white/60 font-light">
              Aerowake uses peer-reviewed sleep science to model your cognitive
              performance across every duty. Understand your alertness patterns,
              identify high-risk windows, to help you make informed decisions.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="border-beam-wrapper cursor-pointer"
              >
                <div className="beam-border"><div className="beam-gradient" /></div>
                <span className="beam-inner block bg-[#5bb8e8]/20 px-7 py-3 text-[13px] font-semibold text-white tracking-wide backdrop-blur-md">
                  Get Started
                </span>
              </button>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                <span className="text-[12px] text-white/50 tracking-wide">
                  EASA ORO.FTL compliant
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={onScrollToContent}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 transition-colors hover:text-white/50"
        style={{ opacity: contentOpacity }}
      >
        <span className="text-[10px] tracking-[0.15em] uppercase">Scroll</span>
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </button>
    </section>
  );
}
