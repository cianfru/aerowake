import { Link } from 'react-router-dom';
import { NON_AFFILIATION_NOTE } from './landingData';

const LINKS = [
  { to: '/privacy', label: 'Privacy & data' },
  { to: '/learn', label: 'Methods & limitations' },
  { to: '/account', label: 'Your account' },
];

export function LandingFooter() {
  return <footer className="border-t border-[#c6dbe6] bg-[#e2eef5] px-6 py-14 text-[#425d73] md:px-10 lg:px-16">
    <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr]">
      <div className="max-w-xl space-y-3">
        <p className="font-serif text-2xl text-[#142e45]">Aerowake</p>
        <p className="text-sm leading-6">Roster and rest planning for pilots, built on published sleep science. Built by a line pilot. Independent scientific and FTL evaluation in progress.</p>
        <p className="text-sm leading-6">{NON_AFFILIATION_NOTE}</p>
      </div>
      <nav aria-label="Footer" className="md:justify-self-end">
        <ul className="grid gap-3 text-sm">
          {LINKS.map((l) => <li key={l.to}><Link to={l.to} className="hover:text-[#142e45] hover:underline">{l.label}</Link></li>)}
          <li><a href="https://github.com/cianfru/aerowake/issues" className="hover:text-[#142e45] hover:underline">Support</a></li>
        </ul>
      </nav>
    </div>
    <p className="mx-auto mt-10 max-w-7xl border-t border-[#c6dbe6] pt-6 text-xs text-[#526579]">© {new Date().getFullYear()} Aerowake</p>
  </footer>;
}
