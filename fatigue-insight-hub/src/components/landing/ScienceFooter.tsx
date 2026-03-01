import { APP_VERSION } from '@/lib/version';

export function ScienceFooter() {
  return (
    <footer className="relative bg-[#000408] py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        {/* Top separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-12" />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          {/* Left — brand + description */}
          <div className="max-w-sm">
            <p className="text-[13px] font-medium text-white/60 tracking-wide mb-2">
              Aerowake
            </p>
            <p className="text-[12px] text-white/35 leading-[1.7] font-light">
              Biomathematical Fatigue Prediction Model for Aviation Professionals
            </p>
          </div>

          {/* Right — version */}
          <div className="md:text-right">
            <p className="text-[10px] text-white/20 font-mono">
              v{APP_VERSION} &middot; &copy; {new Date().getFullYear()} Aerowake
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
