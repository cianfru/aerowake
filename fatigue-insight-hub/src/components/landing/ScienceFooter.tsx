import { Link } from 'react-router-dom';
export function ScienceFooter() {
  return <footer className="border-t border-slate-800 bg-[#000408] px-6 py-14 text-slate-300"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8">
    <div className="max-w-lg space-y-3"><p className="font-medium text-white">AeroWake</p><p className="text-sm leading-6">Built on published sleepiness research. AeroWake's parsing, sleep assumptions and reporting features require independent evaluation. Always follow your operator's fatigue reporting process.</p><p className="text-xs text-slate-400">© {new Date().getFullYear()} AeroWake</p></div>
    <nav aria-label="Footer" className="flex flex-wrap items-start gap-6 text-sm"><Link to="/privacy" className="hover:text-white">Privacy & data</Link><Link to="/learn" className="hover:text-white">Methods & limitations</Link><Link to="/account" className="hover:text-white">Your account</Link><a href="https://github.com/cianfru/aerowake/issues" className="hover:text-white">Support</a></nav>
  </div></footer>;
}
