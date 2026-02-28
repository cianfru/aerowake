import { APP_VERSION } from '@/lib/version';

export function Footer() {
  return (
    <footer className="border-t border-border/50 glass-subtle px-4 md:px-6 py-3 md:py-4">
      <div className="text-center text-[10px] md:text-xs text-muted-foreground">
        <p className="font-medium">Aerowake v{APP_VERSION}</p>
        <p className="mt-1 hidden sm:block">
          Biomathematical alertness model grounded in 56 peer-reviewed studies · EASA ORO.FTL Compliant
        </p>
      </div>
    </footer>
  );
}
