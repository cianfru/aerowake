import {
  MapPin, Hash, ArrowRight, Upload, LogIn, Plane, LayoutDashboard,
  BarChart3, Activity, FileText, FolderOpen, Users, CalendarRange,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ── Navigation Row ──────────────────────────────────────────

interface NavRowProps {
  tabId: string;
  icon: LucideIcon;
  title: string;
  description: string;
  setActiveTab: (tab: string) => void;
}

function NavRow({ tabId, icon: Icon, title, description, setActiveTab }: NavRowProps) {
  return (
    <button
      onClick={() => setActiveTab(tabId)}
      className={cn(
        'group flex items-center gap-4 w-full text-left',
        'rounded-xl px-5 py-4',
        'bg-card/80 border border-border/60',
        'transition-all duration-200',
        'hover:bg-accent hover:border-primary/50',
        'hover:shadow-md hover:shadow-primary/5',
      )}
    >
      <div className={cn(
        'h-10 w-10 shrink-0 rounded-lg flex items-center justify-center',
        'bg-muted/80 border border-border/40',
        'group-hover:bg-primary/15 group-hover:border-primary/30',
        'transition-colors duration-200',
      )}>
        <Icon className="h-5 w-5 text-foreground/70 group-hover:text-primary transition-colors duration-200" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────

export function SummaryPage() {
  const { state, setActiveTab } = useAnalysis();
  const { isAuthenticated } = useAuth();

  const { analysisResults, settings } = state;

  const pilotName = analysisResults?.pilotName || null;
  const pilotId = analysisResults?.pilotId || (settings.pilotId !== 'P12345' ? settings.pilotId : null);
  const pilotBase = analysisResults?.pilotBase || settings.homeBase;
  const pilotAircraft = analysisResults?.pilotAircraft || null;
  const hasPilotInfo = pilotName || (pilotId && pilotId !== 'P12345') || pilotBase;

  // ── Not authenticated + no analysis: Getting Started ──

  if (!isAuthenticated && !analysisResults) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <img src={logoDark} alt="Aerowake" className="h-12 md:h-16 w-auto mx-auto object-contain logo-themed" />
              <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
                Biomathematical Fatigue Prediction Model for airline pilots.
                Upload a roster to get started, or sign in to access your saved analyses.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="glow" onClick={() => setActiveTab('rosters')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Roster
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/login'}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── Navigation Hub ────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
        {/* Welcome Header */}
        <div className="text-center space-y-2 pt-4 md:pt-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            {pilotName ? `Welcome back, ${pilotName}` : 'Welcome Back'}
          </h1>
          {hasPilotInfo && (
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
              {pilotBase && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {pilotBase}
                </span>
              )}
              {pilotAircraft && (
                <span className="flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5" />
                  {pilotAircraft}
                </span>
              )}
              {pilotId && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="font-mono">{pilotId}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation Cards — stacked */}
        <div className="space-y-2">
          <NavRow tabId="rosters" icon={FolderOpen} title="Rosters" description="Upload and manage your crew rosters" setActiveTab={setActiveTab} />
          <NavRow tabId="summary" icon={LayoutDashboard} title="Summary" description="Roster overview with key statistics and route map" setActiveTab={setActiveTab} />
          <NavRow tabId="analysis" icon={BarChart3} title="Analysis" description="Chronogram with duty bars, sleep blocks, and performance" setActiveTab={setActiveTab} />
          <NavRow tabId="insights" icon={Activity} title="Insights" description="Performance trends, sleep debt, and body clock drift" setActiveTab={setActiveTab} />
          <NavRow tabId="reports" icon={FileText} title="Reports" description="Generate PDF fatigue reports for each duty" setActiveTab={setActiveTab} />
          <NavRow tabId="compare" icon={Users} title="Compare" description="Compare your fatigue metrics against fleet percentiles" setActiveTab={setActiveTab} />
          <NavRow tabId="yearly" icon={CalendarRange} title="12-Month Dashboard" description="Long-term fatigue trends and seasonal patterns" setActiveTab={setActiveTab} />
        </div>

        {/* Sign-in prompt for guests */}
        {!isAuthenticated && (
          <div className="rounded-xl border border-border/60 bg-card/80 p-5 text-center space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Sign In for Full Access</h3>
            <p className="text-xs text-muted-foreground">
              Save rosters, compare metrics, and access the 12-month dashboard.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}>
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
