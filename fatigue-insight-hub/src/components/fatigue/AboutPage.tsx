import { Badge } from '@/components/ui/badge';
import { Brain, BookOpen, Shield, Eye, Github, Heart } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6 pb-16">

      {/* Hero */}
      <div className="rounded-2xl glass-strong px-6 py-8 md:px-8 md:py-10 text-center space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Aerowake</h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
          A biomathematical fatigue prediction tool for airline pilots.
          Upload your roster, see how alert you'll be on every duty.
        </p>
        <div className="flex justify-center gap-2 flex-wrap">
          <Badge variant="info">v{APP_VERSION}</Badge>
          <Badge variant="success">EASA ORO.FTL</Badge>
          <Badge variant="outline">Borbély Two-Process</Badge>
        </div>
      </div>

      {/* Why it exists */}
      <div className="rounded-2xl glass px-6 py-6 md:px-8 space-y-3">
        <SectionLabel>Why this exists</SectionLabel>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Duty hour limits tell you whether you're legal. They don't tell you whether you're rested.
          Two pilots can fly the same schedule and arrive at the flight deck in very different states,
          depending on when they slept, how well, and where their body clock sits.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aerowake models that difference. It takes your roster, estimates your sleep patterns,
          and runs a peer-reviewed fatigue simulation to predict your cognitive performance
          across every duty. Hour by hour, phase by phase.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-2xl glass px-6 py-6 md:px-8 space-y-4">
        <SectionLabel>How it works</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PillarCard
            icon={<Brain className="h-4 w-4" />}
            title="Peer-reviewed science"
            description="Built on the Borbély Two-Process Model with 56 cited references. No proprietary black boxes."
          />
          <PillarCard
            icon={<Eye className="h-4 w-4" />}
            title="Fully transparent"
            description="Every performance score decomposes into sleep pressure, circadian phase, time on task, and sleep inertia."
          />
          <PillarCard
            icon={<Shield className="h-4 w-4" />}
            title="EASA-aligned"
            description="ORO.FTL compliance validation, WOCL detection, FDP limits, and acclimatization tracking built in."
          />
        </div>
      </div>

      {/* Acknowledgments */}
      <div className="rounded-2xl glass px-6 py-6 md:px-8 space-y-4">
        <SectionLabel>Acknowledgments</SectionLabel>

        <div className="space-y-3">
          {/* Research */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Research foundations</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Borbély & Achermann · Van Dongen, Maislin, Mullington & Dinges ·
              Signal, Gander & van den Berg · Roach, Dawson & Lamond ·
              Åkerstedt & Folkard · Banks, Van Dongen & Dinges ·
              Kosmadopoulos, Sargent & Darwent
            </p>
          </div>

          {/* Open source */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Heart className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Built with</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Python · FastAPI · NumPy · React · TypeScript · Vite ·
              Tailwind CSS · shadcn/ui · Recharts · Mapbox
            </p>
          </div>

          {/* GitHub */}
          <a
            href="https://github.com/cianfru/aerowake"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            <span>github.com/cianfru/aerowake</span>
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-2 pt-4">
        <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
          Made in Doha, and more often than not, at 39,000 ft.
        </p>
        <p className="text-[11px] text-muted-foreground/50">Andrea Cianfruglia</p>
        <Badge variant="outline" className="text-[10px]">v{APP_VERSION}</Badge>
      </div>
    </div>
  );
}

// Sub-components

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{children}</span>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  );
}

function PillarCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-secondary/20 border border-border/25 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
