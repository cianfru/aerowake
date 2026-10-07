import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { RestExampleSection } from './RestExampleSection';
import { ProductTourSection } from './ProductTourSection';
import { PrinciplesSection } from './PrinciplesSection';
import { FinalCta } from './FinalCta';
import { LandingFooter } from './LandingFooter';
import { useLandingHead } from './useLandingHead';
import { useTheme } from '@/hooks/useTheme';
import './landing.css';

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  useLandingHead();
  // Night by default, like the workspace; a saved daylight preference keeps the paper edition.
  const { theme } = useTheme();
  return <div className={theme === 'light' ? 'light landing-daylight landing-editorial' : 'dark landing-night landing-editorial'}>
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
