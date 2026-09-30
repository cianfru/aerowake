import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { TrustStrip } from './TrustStrip';
import { SampleDutiesSection } from './SampleDutiesSection';
import { StepsSection } from './StepsSection';
import { FinalCta } from './FinalCta';
import { LandingFooter } from './LandingFooter';

interface LandingPageProps {
  onEnter: () => void;
}

/** Public landing: always daylight, planning first, credibility below the fold. */
export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="light landing-daylight min-h-screen bg-[#f8fbfd] text-[#142e45]">
      <LandingHeader onEnter={onEnter} />
      <main>
        <HeroSection onEnter={onEnter} />
        <TrustStrip />
        <SampleDutiesSection />
        <StepsSection />
        <FinalCta onEnter={onEnter} />
      </main>
      <LandingFooter />
    </div>
  );
}
