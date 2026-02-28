import { APP_VERSION } from '@/lib/version';

export function ScienceFooter() {
  return (
    <footer className="relative bg-[#000408] border-t border-white/[0.05] py-10 md:py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col items-center text-center">
          <p className="text-xs text-white/25 font-mono uppercase tracking-wider">
            Aerowake v{APP_VERSION}
          </p>
          <p className="mt-2 text-xs text-white/20 max-w-md leading-relaxed">
            Biomathematical fatigue prediction for aviation professionals.
            Educational tool only — not for operational go/no-go decisions.
          </p>

          {/* Science citations */}
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {[
              'Borbely & Achermann (1999)',
              'EASA Moebus Report (2008-2013)',
              'Gander et al. (1994)',
              'Signal et al. (2009)',
            ].map((cite) => (
              <span key={cite} className="text-[10px] text-white/15 font-mono">
                {cite}
              </span>
            ))}
          </div>

          <p className="mt-6 text-[10px] text-white/10">
            &copy; {new Date().getFullYear()} Aerowake. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
