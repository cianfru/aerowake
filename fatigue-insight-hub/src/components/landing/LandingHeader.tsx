import { Link } from 'react-router-dom';
import logoDark from '@/assets/logo-dark.png';

export function LandingHeader({ onEnter }: { onEnter: () => void }) {
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#000408]/90 backdrop-blur-xl">
    <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 md:px-8">
      <a href="#" aria-label="AeroWake home"><img src={logoDark} alt="AeroWake" className="h-8 w-auto max-w-[130px] object-contain" /></a>
      <div className="flex items-center gap-3 text-sm">
        <Link to="/privacy" className="hidden text-white/65 hover:text-white sm:block">Your data</Link>
        <Link to="/login" className="whitespace-nowrap text-white/80 hover:text-white">Sign in</Link>
        <button onClick={onEnter} className="whitespace-nowrap rounded-md bg-blue-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">Analyze roster</button>
      </div>
    </nav>
  </header>;
}
