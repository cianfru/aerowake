import { useState } from 'react';
import {
  Plane, MapPin, Hash, Timer, FileText, Eye, ArrowRight, Upload, LogIn, Link,
  BarChart3, Activity, CalendarRange, Users,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import { PilotAvatar } from './PilotAvatar';
import { RouteNetworkMapbox } from './RouteNetworkMapbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatisticsCards } from './StatisticsCards';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { useAllDuties } from '@/hooks/useAllDuties';
import { getRoster } from '@/lib/api-client';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { cn } from '@/lib/utils';
import type { RosterSummary } from '@/lib/api-client';
import type { LucideIcon } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

function formatMonth(month: string) {
  try {
    const [year, m] = month.split('-');
    return new Date(Number(year), Number(m) - 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return month;
  }
}

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
  const { state, loadAnalysis, loadAnalysisToSummary, setActiveTab } = useAnalysis();
  const { isAuthenticated } = useAuth();
  const { rosters, isLoading } = useRosterHistory();
  const { allDuties, isLoading: isLoadingDuties } = useAllDuties();
  const [loadingRosterId, setLoadingRosterId] = useState<string | null>(null);

  const { analysisResults, settings } = state;

  // Pilot details (fallback chain: analysis → settings)
  const pilotName = analysisResults?.pilotName || null;
  const pilotId = analysisResults?.pilotId || (settings.pilotId !== 'P12345' ? settings.pilotId : null);
  const pilotBase = analysisResults?.pilotBase || settings.homeBase;
  const pilotAircraft = analysisResults?.pilotAircraft || null;

  const hasPilotInfo = pilotName || (pilotId && pilotId !== 'P12345') || pilotAircraft;
  const hasRosters = !isLoading && rosters.length > 0;

  // Load roster and stay on summary page
  const handleViewRoster = async (roster: RosterSummary) => {
    if (!roster.analysis_id) return;
    setLoadingRosterId(roster.id);
    try {
      const detail = await getRoster(roster.id);
      if (detail.analysis) {
        const [year, month] = (roster.month || '2026-01').split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);
        loadAnalysisToSummary(transformed);
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoadingRosterId(null);
    }
  };

  // ── Empty / Getting Started State (not authenticated, no analysis) ──

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

  // ── Main Summary View ──────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        {/* Pilot Identity Card */}
        {hasPilotInfo && (
          <Card variant="glass">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-4">
                <PilotAvatar pilotName={pilotName} size="md" />
                <div className="flex-1 min-w-0">
                  {pilotName && (
                    <h2 className="text-lg font-semibold truncate">{pilotName}</h2>
                  )}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    {pilotId && (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        <span className="font-mono">{pilotId}</span>
                      </span>
                    )}
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Network Map */}
        {(allDuties.length > 0 || isLoadingDuties) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Route Network</h3>
            {isLoadingDuties ? (
              <Skeleton className="h-[350px] w-full rounded-xl" />
            ) : (
              <RouteNetworkMapbox
                duties={allDuties}
                homeBase={pilotBase}
                theme={settings.theme}
              />
            )}
          </div>
        )}

        {/* Latest Analysis Statistics */}
        {analysisResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-muted-foreground">Latest Analysis</h3>
                <Badge variant="outline" className="text-[10px]">
                  {analysisResults.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </Badge>
                {analysisResults.continuityFromMonth && (
                  <Badge variant="info" className="text-[10px] gap-1">
                    <Link className="h-2.5 w-2.5" />
                    Carried over from{' '}
                    {new Date(
                      Number(analysisResults.continuityFromMonth.split('-')[0]),
                      Number(analysisResults.continuityFromMonth.split('-')[1]) - 1,
                    ).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={() => setActiveTab('analysis')}
              >
                View Full Analysis
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
            <StatisticsCards
              statistics={analysisResults.statistics}
              duties={analysisResults.duties}
            />
          </div>
        )}

        {/* ── Bento Navigation Grid (when analysis is loaded) ── */}
        {analysisResults && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Explore Your Analysis</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Analysis / Chronogram — primary, spans 2 cols + 2 rows */}
              <NavigationCard
                tabId="analysis"
                icon={BarChart3}
                title="Analysis"
                description="Full chronogram with duty bars, sleep blocks, and continuous performance timeline"
                className="md:col-span-2 md:row-span-2"
                variant="primary"
                preview={
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
                }
                staggerIndex={0}
                setActiveTab={setActiveTab}
              />

              {/* Insights */}
              <NavigationCard
                tabId="insights"
                icon={Activity}
                title="Insights"
                description="Performance trends, sleep debt evolution, and body clock drift"
                preview={
                  <div className="flex items-center gap-1.5 mt-3">
                    <Badge variant={analysisResults.statistics.highRiskDuties > 0 ? 'warning' : 'success'} className="text-[10px]">
                      {analysisResults.statistics.highRiskDuties} high risk
                    </Badge>
                    <Badge variant={analysisResults.statistics.criticalRiskDuties > 0 ? 'critical' : 'success'} className="text-[10px]">
                      {analysisResults.statistics.criticalRiskDuties} critical
                    </Badge>
                  </div>
                }
                staggerIndex={1}
                setActiveTab={setActiveTab}
              />

              {/* Reports */}
              <NavigationCard
                tabId="reports"
                icon={FileText}
                title="Reports"
                description="Generate PDF fatigue reports for each duty period"
                preview={
                  <span className="text-[11px] text-muted-foreground mt-3 block">
                    {analysisResults.duties.length} duty reports available
                  </span>
                }
                staggerIndex={2}
                setActiveTab={setActiveTab}
              />

              {/* Compare (auth-gated) */}
              {isAuthenticated && (
                <NavigationCard
                  tabId="compare"
                  icon={Users}
                  title="Compare"
                  description="Compare your fatigue metrics against fleet-wide percentiles"
                  staggerIndex={3}
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
                  staggerIndex={4}
                  setActiveTab={setActiveTab}
                />
              )}
            </div>
          </div>
        )}

        {/* ── No analysis: Welcome + Roster Picker ── */}
        {!analysisResults && isAuthenticated && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl md:text-2xl font-semibold">
                {pilotName ? `Welcome back, ${pilotName}` : 'Welcome Back'}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {hasRosters
                  ? 'Select a roster to view your fatigue analysis.'
                  : 'Upload your first roster to get started with fatigue prediction.'}
              </p>
            </div>

            {/* Roster cards */}
            {hasRosters && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Your Rosters</h3>
                <div className="grid gap-3">
                  {rosters.slice(0, 5).map((roster, i) => (
                    <button
                      key={roster.id}
                      onClick={() => handleViewRoster(roster)}
                      disabled={!roster.analysis_id || loadingRosterId === roster.id}
                      className={cn(
                        'w-full text-left rounded-2xl glass p-4 md:p-5',
                        'border border-border/50 hover:border-primary/40',
                        'transition-all duration-300 hover:scale-[1.01]',
                        'group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                        'animate-fade-in-up',
                        `stagger-${i + 1}`,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold">{formatMonth(roster.month)}</span>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              {roster.total_duties != null && <span>{roster.total_duties} duties</span>}
                              {roster.total_block_hours != null && <span>{roster.total_block_hours.toFixed(1)}h block</span>}
                              {roster.total_duty_hours != null && (
                                <span className="flex items-center gap-1">
                                  <Timer className="h-2.5 w-2.5" />
                                  {roster.total_duty_hours.toFixed(1)}h duty
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {loadingRosterId === roster.id ? (
                            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {rosters.length > 5 && (
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('rosters')} className="w-full text-xs">
                    View all {rosters.length} rosters
                  </Button>
                )}
              </div>
            )}

            {/* Upload CTA */}
            <button
              onClick={() => setActiveTab('rosters')}
              className="w-full rounded-2xl glass border-2 border-dashed border-border/50 hover:border-primary/30 transition-all duration-300 p-6 text-center group"
            >
              <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary mx-auto mb-2 transition-colors duration-200" />
              <p className="text-sm font-medium">Upload New Roster</p>
              <p className="text-xs text-muted-foreground mt-1">PDF or CSV from your airline crew portal</p>
            </button>
          </div>
        )}

        {/* ── Stored Rosters (compact, below bento grid when analysis loaded) ── */}
        {isAuthenticated && analysisResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Your Rosters</h3>
                {rosters.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {rosters.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary"
                onClick={() => setActiveTab('rosters')}
              >
                Manage Rosters
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-secondary/20 animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoading && rosters.length === 0 && (
              <Card variant="glass" className="p-6 text-center">
                <div className="space-y-2">
                  <span className="text-3xl">📁</span>
                  <p className="text-sm text-muted-foreground">
                    No saved rosters yet. Upload and analyze a roster to save it here.
                  </p>
                </div>
              </Card>
            )}

            {/* Roster list (compact rows) */}
            {!isLoading && rosters.length > 0 && (
              <div className="space-y-2">
                {rosters.map((roster) => (
                  <Card
                    key={roster.id}
                    variant="glass"
                    className="group hover:border-primary/30 transition-all duration-200 cursor-pointer"
                    onClick={() => handleViewRoster(roster)}
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{formatMonth(roster.month)}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{roster.filename}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                              {roster.total_duties != null && (
                                <span>{roster.total_duties} duties</span>
                              )}
                              {roster.total_duty_hours != null && (
                                <span className="flex items-center gap-1">
                                  <Timer className="h-2.5 w-2.5" />
                                  {roster.total_duty_hours.toFixed(1)}h
                                </span>
                              )}
                              {roster.total_block_hours != null && (
                                <span>{roster.total_block_hours.toFixed(1)}h block</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-primary flex-shrink-0"
                          disabled={!roster.analysis_id || loadingRosterId === roster.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRoster(roster);
                          }}
                        >
                          {loadingRosterId === roster.id ? (
                            <div className="h-3.5 w-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Not authenticated prompt */}
        {!isAuthenticated && (
          <Card variant="glass" className="p-6 text-center">
            <div className="space-y-3">
              <span className="text-3xl">🔐</span>
              <h3 className="text-base font-semibold">Sign In for Roster History</h3>
              <p className="text-sm text-muted-foreground">
                Sign in to save your rosters and access them from any device.
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
