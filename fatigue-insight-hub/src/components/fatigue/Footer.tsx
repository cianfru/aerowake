import { Link } from 'react-router-dom';
import { APP_VERSION, BUILD_SHA } from '@/lib/version';

export function Footer() {
  return (
    <footer className="border-t border-border/50 glass-subtle px-4 md:px-6 py-3 md:py-4">
      <div className="text-center text-[10px] md:text-xs text-muted-foreground">
        <nav className="mb-3 flex justify-center gap-5 text-sm"><Link to="/account">Account and data</Link><Link to="/privacy">Privacy and limitations</Link></nav>
        <details className="mb-3"><summary className="cursor-pointer">Build information</summary><p className="mt-2 font-mono">Frontend {BUILD_SHA.slice(0, 12)} · Map: keyless bundled SVG</p></details>
        <p className="font-medium">Aerowake v{APP_VERSION}</p>
        <p className="mt-1 hidden sm:block">
          Alertness model: Three Process Model (Ingre et al. 2014) · EASA ORO.FTL checks
        </p>
      </div>
    </footer>
  );
}
