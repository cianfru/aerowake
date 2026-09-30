import { Link } from 'react-router-dom';
import { ArrowRight, EyeOff, FileLock2, KeyRound, ServerOff } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';

const FACTS = [
  { icon: KeyRound, title: 'No account needed', body: 'Guest analyses are held in server memory for up to one hour, then discarded.' },
  { icon: FileLock2, title: 'You decide what is kept', body: 'Signed in, rosters stay in your history until you delete them. Export or delete your account at any time.' },
  { icon: EyeOff, title: 'Kept out of logs', body: 'Roster contents are not written to application logs. Fatigue reports are generated on request, not stored on the server.' },
  { icon: ServerOff, title: 'No third-party requests', body: 'Maps and fonts ship with the app: no map tiles, font services or tracking scripts.' },
];

export function PrivacySection() {
  return <section id="privacy" aria-labelledby="privacy-title" className="landing-section border-y border-[#d3e3eb] bg-[#edf3f6]">
    <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
      <ScrollReveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl space-y-5">
          <p className="landing-eyebrow">Privacy</p>
          <h2 id="privacy-title" className="landing-h2">Private by default.</h2>
          <p className="text-base leading-7 text-[#425d73]">Your roster says a lot about you. Aerowake keeps as little of it as it can, for as short a time as it can.</p>
        </div>
        <Link to="/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-[#175779] underline decoration-[#175779]/30 underline-offset-4 hover:decoration-[#175779]">Read how your data is handled <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
      </ScrollReveal>
      <ScrollReveal delay={60}>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#c9dbe4] bg-[#c9dbe4] shadow-[0_24px_48px_-36px_#285c7659] sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ icon: Icon, title, body }) => <li key={title} className="bg-[#fcfdfe] p-6">
            <Icon aria-hidden="true" className="h-5 w-5 text-[#087478]" />
            <h3 className="mt-4 font-medium text-[#142e45]">{title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-[#425d73]">{body}</p>
          </li>)}
        </ul>
      </ScrollReveal>
    </div>
  </section>;
}
