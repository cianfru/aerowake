import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { ArcMotif } from './ArcMotif';

export function FinalCta({ onEnter }: { onEnter: () => void }) {
  return <section aria-labelledby="final-cta-title" className="bg-[#f8fbfd] px-6 pb-20 md:px-10 md:pb-28 lg:px-16">
    <ScrollReveal>
      <div className="landing-navy relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#2c566b] px-6 py-14 shadow-[0_32px_64px_-40px_#0f2c3d] sm:px-12 md:py-20">
        <ArcMotif className="bottom-[-14rem] right-[-6rem] h-[34rem] w-[34rem] opacity-[0.09]" />
        <div className="relative max-w-2xl">
          <h2 id="final-cta-title" className="landing-h2">Start with your next roster.</h2>
          <p className="mt-5 text-lg leading-8 text-[#c9dde6]">No account needed. Upload a PDF or CSV, confirm the details and see every duty, sleep opportunity and scoped FTL check for the month.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onEnter} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f4f8fa] px-7 py-3.5 text-sm font-semibold text-[#12324a] shadow-[0_10px_24px_-14px_#000] transition-colors hover:bg-[#dcebf2] sm:w-auto">Analyse a roster <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
            <Link to="/report" className="inline-flex w-full items-center justify-center rounded-full border border-[#4d7488] px-6 py-3.5 text-sm font-semibold text-[#e8f2f6] transition-colors hover:bg-[#18405a] sm:w-auto">Log how a duty went</Link>
          </div>
          <p className="mt-6 text-sm text-[#b9d0db]">Built by a line pilot, for line pilots.</p>
        </div>
      </div>
    </ScrollReveal>
  </section>;
}
