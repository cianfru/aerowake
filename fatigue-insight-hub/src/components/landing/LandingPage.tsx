import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { TrustStrip } from './TrustStrip';
import { SampleDutiesSection } from './SampleDutiesSection';
import { ProductTourSection } from './ProductTourSection';
import { ScienceSection } from './ScienceSection';
import { OperationsSection } from './OperationsSection';
import { PrivacySection } from './PrivacySection';
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
        <ProductTourSection />
        <ScienceSection />
        <OperationsSection />
        <PrivacySection />
        <StepsSection />
        <FinalCta onEnter={onEnter} />
      </main>
      <LandingFooter />
    </div>
  );
}
