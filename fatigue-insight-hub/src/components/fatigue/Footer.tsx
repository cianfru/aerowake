export function Footer() {
  return (
    <footer className="border-t border-border/30 glass-subtle px-4 md:px-6 py-3 md:py-4">
      <div className="text-center text-[10px] md:text-xs text-muted-foreground">
        <p className="font-medium">EASA Fatigue Analysis Tool v2.1.2</p>
        <p className="mt-1 hidden sm:block">
          Based on Borbély Two-Process Model • EASA ORO.FTL Compliant
        </p>
        <p className="mt-1 opacity-70 hidden md:block">
          Scientific references: Borbély & Achermann (1999), Van Dongen et al. (2003), Dinges et al. (1997)
        </p>
      </div>
    </footer>
  );
}
