import { useRef } from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { AppShowcaseSection } from './AppShowcaseSection';
import { ProblemSolutionSection } from './ProblemSolutionSection';
import { HowItWorksSection } from './HowItWorksSection';
import { ScienceFooter } from './ScienceFooter';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToContent = () => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#000408]">
      <LandingHeader onEnter={onEnter} />
      <HeroSection onScrollToContent={scrollToContent} />
      <div ref={contentRef} />
      <AppShowcaseSection />
      <ProblemSolutionSection />
      <HowItWorksSection />
      <ScienceFooter />
    </div>
  );
}
