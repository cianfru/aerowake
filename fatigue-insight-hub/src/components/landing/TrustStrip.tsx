import { Link } from 'react-router-dom';
import { Activity, Gauge, LockKeyhole, ShieldCheck, type LucideIcon } from 'lucide-react';

interface TrustItem {
  icon: LucideIcon;
  title: string;
  body: string;
  to: string;
  cta: string;
}

const ITEMS: TrustItem[] = [
  { icon: Activity, title: 'Three Process Model', body: 'Sleep pressure and body clock, in the form validated on airline crew (Ingre et al., 2014).', to: '#science', cta: 'How the model works' },
  { icon: Gauge, title: 'KSS 1–9', body: 'Karolinska Sleepiness Scale (Åkerstedt & Gillberg, 1990). Bands begin at 5.5, 6.5, 7.5 and 8.5.', to: '/learn', cta: 'Methods & limitations' },
  { icon: ShieldCheck, title: 'EASA ORO.FTL references', body: "Scoped checks on the duties you supply. Your operator's approved scheme prevails.", to: '#operations', cta: 'Working alongside your operator' },
  { icon: LockKeyhole, title: 'Private by default', body: 'No account needed. Guest analyses are held in memory for up to one hour.', to: '/privacy', cta: 'Privacy & data' },
];

/** Credibility band under the hero: each claim links to where it is explained. */
export function TrustStrip() {
  return <section aria-labelledby="trust-title" className="landing-navy relative border-y border-[#2c566b]">
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-12 lg:px-16">
      <h2 id="trust-title" className="mb-7 text-sm font-medium text-[#b9d0db]">Published science. Visible assumptions. Your judgement.</h2>
      <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, body, to, cta }) => {
          const content = <>
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#3a6679] bg-[#18405a] text-[#7fd0dc] shadow-[inset_0_1px_0_#ffffff14]"><Icon aria-hidden="true" className="h-4 w-4" /></span>
            <span className="block font-medium text-[#f4f8fa]">{title}</span>
            <span className="mt-1.5 block text-sm leading-6 text-[#b9d0db]">{body}</span>
            <span className="mt-2 inline-block text-sm font-medium text-[#8fdce6] underline decoration-[#8fdce6]/40 underline-offset-4 group-hover:decoration-[#8fdce6]">{cta}</span>
          </>;
          return <li key={title}>
            {to.startsWith('#')
              ? <a href={to} className="group block rounded-lg">{content}</a>
              : <Link to={to} className="group block rounded-lg">{content}</Link>}
          </li>;
        })}
      </ul>
    </div>
  </section>;
}
