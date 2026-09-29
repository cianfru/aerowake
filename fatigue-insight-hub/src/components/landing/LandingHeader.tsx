import { Link } from 'react-router-dom';
import logoDark from '@/assets/logo-dark.png';

export function LandingHeader({ onEnter }: { onEnter: () => void }) {
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c6dbe6] bg-[#f8fbfd]/95 backdrop-blur-xl">
    <nav aria-label="Main navigation" className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 md:px-10 lg:px-16">
      <a href="#" aria-label="AeroWake home"><img src={logoDark} alt="AeroWake" className="logo-themed h-8 w-auto max-w-[130px] object-contain" /></a>
      <div className="flex items-center gap-4 text-sm">
        <a href="#sample-report" className="hidden text-[#425d73] hover:text-[#142e45] md:block">How it works</a>
        <Link to="/login" className="whitespace-nowrap text-[#173d57] hover:underline">Sign in</Link>
        <button onClick={onEnter} className="whitespace-nowrap rounded-full bg-[#175779] px-4 py-2.5 font-medium text-slate-50 transition-colors hover:bg-[#123e58]">Analyze roster</button>
      </div>
    </nav>
  </header>;
}
