import {
  Plane, MapPin, Hash, ArrowRight, Upload, LogIn,
  BarChart3, Activity, FileText, CalendarRange, Users, FolderOpen,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ── Navigation Card ──────────────────────────────────────────

interface NavigationCardProps {
  tabId: string;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  variant?: 'default' | 'primary';
  preview?: React.ReactNode;
  staggerIndex: number;
  setActiveTab: (tab: string) => void;
}

function NavigationCard({
  tabId, icon: Icon, title, description, className,
  variant = 'default', preview, staggerIndex, setActiveTab,
}: NavigationCardProps) {
  return (
    <button
      onClick={() => setActiveTab(tabId)}
      className={cn(
        'group relative text-left rounded-2xl p-5 md:p-6',
        'glass border border-border/50',
        'transition-all duration-300',
        'hover:border-primary/40 hover:scale-[1.015]',
        'hover:shadow-[0_0_30px_hsl(var(--primary)/0.1)]',
        'animate-fade-in-up',
        `stagger-${staggerIndex + 1}`,
        variant === 'primary' && 'glow-pulse border-primary/20',
        className,
      )}
    >
      {/* Icon */}
      <div className={cn(
        'h-10 w-10 rounded-xl flex items-center justify-center mb-3',
        'transition-colors duration-300',
        variant === 'primary'
          ? 'bg-primary/15 group-hover:bg-primary/25'
          : 'bg-secondary/60 group-hover:bg-primary/15',
      )}>
        <Icon className={cn(
          'h-5 w-5 transition-colors duration-300',
          variant === 'primary'
            ? 'text-primary'
            : 'text-muted-foreground group-hover:text-primary',
        )} />
      </div>

      {/* Title + Arrow */}
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {description}
      </p>

      {/* Optional preview */}
      {preview}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────

export function SummaryPage() {
  const { state, setActiveTab } = useAnalysis();
  const { isAuthenticated } = useAuth();

  const { analysisResults, settings } = state;

  // Pilot details (fallback chain: analysis → settings)
  const pilotName = analysisResults?.pilotName || null;
  const pilotId = analysisResults?.pilotId || (settings.pilotId !== 'P12345' ? settings.pilotId : null);
  const pilotBase = analysisResults?.pilotBase || settings.homeBase;
  const pilotAircraft = analysisResults?.pilotAircraft || null;

  const hasPilotInfo = pilotName || (pilotId && pilotId !== 'P12345') || pilotBase;

  // ── Not authenticated + no analysis: Getting Started ──

  if (!isAuthenticated && !analysisResults) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
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
      <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
        {/* Welcome Header */}
        <div className="text-center space-y-2 pt-4 md:pt-8">
          <h1 className="text-2xl md:text-3xl font-semibold">
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

        {/* Bento Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Rosters — upload & manage */}
          <NavigationCard
            tabId="rosters"
            icon={FolderOpen}
            title="Rosters"
            description="Upload, manage, and select your crew rosters for analysis"
            preview={
              analysisResults ? (
                <Badge variant="info" className="text-[10px] mt-3">
                  {analysisResults.month.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} loaded
                </Badge>
              ) : (
                <span className="text-[11px] text-primary/70 mt-3 block font-medium">
                  Upload a roster to begin
                </span>
              )
            }
            staggerIndex={0}
            setActiveTab={setActiveTab}
          />

          {/* Analysis / Chronogram — primary, spans 2 cols + 2 rows */}
          <NavigationCard
            tabId="analysis"
            icon={BarChart3}
            title="Analysis"
            description="Full chronogram with duty bars, sleep blocks, and continuous performance timeline"
            className="md:col-span-2 md:row-span-2"
            variant="primary"
            preview={
              analysisResults ? (
                <div className="flex items-center gap-2 mt-3">
                  <div className="h-2 flex-1 rounded-full bg-secondary/50 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        analysisResults.statistics.worstPerformance >= 77 ? 'bg-success' :
                        analysisResults.statistics.worstPerformance >= 55 ? 'bg-warning' : 'bg-critical',
                      )}
                      style={{ width: `${analysisResults.statistics.worstPerformance}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {Math.round(analysisResults.statistics.worstPerformance)}% worst
                  </span>
                </div>
              ) : undefined
            }
            staggerIndex={1}
            setActiveTab={setActiveTab}
          />

          {/* Insights */}
          <NavigationCard
            tabId="insights"
            icon={Activity}
            title="Insights"
            description="Performance trends, sleep debt evolution, and body clock drift"
            preview={
              analysisResults ? (
                <div className="flex items-center gap-1.5 mt-3">
                  <Badge variant={analysisResults.statistics.highRiskDuties > 0 ? 'warning' : 'success'} className="text-[10px]">
                    {analysisResults.statistics.highRiskDuties} high risk
                  </Badge>
                  <Badge variant={analysisResults.statistics.criticalRiskDuties > 0 ? 'critical' : 'success'} className="text-[10px]">
                    {analysisResults.statistics.criticalRiskDuties} critical
                  </Badge>
                </div>
              ) : undefined
            }
            staggerIndex={2}
            setActiveTab={setActiveTab}
          />

          {/* Reports */}
          <NavigationCard
            tabId="reports"
            icon={FileText}
            title="Reports"
            description="Generate PDF fatigue reports for each duty period"
            preview={
              analysisResults ? (
                <span className="text-[11px] text-muted-foreground mt-3 block">
                  {analysisResults.duties.length} duty reports available
                </span>
              ) : undefined
            }
            staggerIndex={3}
            setActiveTab={setActiveTab}
          />

          {/* Compare (auth-gated) */}
          {isAuthenticated && (
            <NavigationCard
              tabId="compare"
              icon={Users}
              title="Compare"
              description="Compare your fatigue metrics against fleet-wide percentiles"
              staggerIndex={4}
              setActiveTab={setActiveTab}
            />
          )}

          {/* 12-Month Dashboard (auth-gated) */}
          {isAuthenticated && (
            <NavigationCard
              tabId="yearly"
              icon={CalendarRange}
              title="12-Month Dashboard"
              description="Long-term fatigue trends, cumulative hours, and seasonal patterns"
              className="md:col-span-2"
              staggerIndex={5}
              setActiveTab={setActiveTab}
            />
          )}
        </div>

        {/* Sign-in prompt for guests */}
        {!isAuthenticated && (
          <Card variant="glass" className="p-6 text-center">
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Sign In for Full Access</h3>
              <p className="text-sm text-muted-foreground">
                Sign in to save rosters, compare metrics, and access the 12-month dashboard.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}>
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Sign In
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
