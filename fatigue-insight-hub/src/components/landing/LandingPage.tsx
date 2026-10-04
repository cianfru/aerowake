import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { RestExampleSection } from './RestExampleSection';
import { ProductTourSection } from './ProductTourSection';
import { PrinciplesSection } from './PrinciplesSection';
import { FinalCta } from './FinalCta';
import { LandingFooter } from './LandingFooter';
import { useLandingHead } from './useLandingHead';
import './landing.css';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  useLandingHead();
  return <div className="light landing-daylight landing-editorial">
    <LandingHeader onEnter={onEnter} />
    <main>
      <HeroSection onEnter={onEnter} />
      <RestExampleSection />
      <ProductTourSection />
      <PrinciplesSection />
      <FinalCta onEnter={onEnter} />
    </main>
    <LandingFooter />
  </div>;
}
