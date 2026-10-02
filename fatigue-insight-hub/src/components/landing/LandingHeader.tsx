import { Link } from 'react-router-dom';
/** 3x wordmark (444×96, 6.5 KB) instead of the 293 KB source, so phones load the header fast. */
const WORDMARK = '/aerowake-wordmark.png';

const SECTIONS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#science', label: 'Science' },
  { href: '#privacy', label: 'Privacy' },
];

export function LandingHeader({ onEnter }: { onEnter: () => void }) {
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c6dbe6]/80 bg-[#fcfdfe]/90 shadow-[0_3px_16px_-12px_#17384f60] backdrop-blur-xl">
    <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:h-[4.5rem] md:px-10 lg:px-16">
      <a href="#top" aria-label="Aerowake home"><img src={WORDMARK} alt="" width={148} height={32} className="logo-themed h-7 w-auto max-w-[118px] object-contain sm:max-w-none md:h-8" /></a>
      <div className="flex items-center gap-1 text-sm sm:gap-2">
        {SECTIONS.map(s => <a key={s.href} href={s.href} className="hidden rounded-[4px] px-3 py-2 text-[#425d73] transition-colors hover:bg-[#e3eef4] hover:text-[#142e45] lg:block">{s.label}</a>)}
        <Link to="/login" className="whitespace-nowrap rounded-[4px] px-3 py-2 text-[#173d57] transition-colors hover:bg-[#e3eef4]">Sign in</Link>
        <button type="button" onClick={onEnter} className="action-raised whitespace-nowrap rounded-[4px] bg-[#175779] px-4 py-2.5 font-medium text-slate-50 transition-colors hover:bg-[#123e58]">Analyse roster</button>
      </div>
    </nav>
  </header>;
}
