import { useState } from 'react';
import { Plane, MapPin, Hash, Timer, FileText, Eye, ArrowRight, Upload, LogIn, Link } from 'lucide-react';
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
import type { RosterSummary } from '@/lib/api-client';

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

// ── Main Component ───────────────────────────────────────────

export function SummaryPage() {
  const { state, loadAnalysis, setActiveTab } = useAnalysis();
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

  const handleViewRoster = async (roster: RosterSummary) => {
    if (!roster.analysis_id) return;
    setLoadingRosterId(roster.id);
    try {
      const detail = await getRoster(roster.id);
      if (detail.analysis) {
        const [year, month] = (roster.month || '2026-01').split('-');
        const fallbackMonth = new Date(Number(year), Number(month) - 1, 1);
        const transformed = transformAnalysisResult(detail.analysis, fallbackMonth);
        loadAnalysis(transformed);
      }
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoadingRosterId(null);
    }
  };

  // ── Empty / Getting Started State ──────────────────────────

  if (!isAuthenticated && !analysisResults) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="space-y-4">
              <img src={logoDark} alt="Aerowake" className="h-12 md:h-16 w-auto mx-auto object-contain" />
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

        {/* No analysis loaded prompt */}
        {!analysisResults && (
          <Card variant="glass" className="p-6 md:p-8 text-center">
            <div className="space-y-3">
              <span className="text-4xl">📊</span>
              <h3 className="text-base font-semibold">No Analysis Loaded</h3>
              <p className="text-sm text-muted-foreground">
                {hasRosters
                  ? 'Select a roster below to view its analysis, or upload a new one.'
                  : 'Upload a roster to generate your fatigue analysis.'}
              </p>
              <Button variant="glow" size="sm" onClick={() => setActiveTab('rosters')}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Go to Rosters
              </Button>
            </div>
          </Card>
        )}

        {/* Stored Rosters Section */}
        {isAuthenticated && (
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

            {/* Roster list (compact rows for summary view) */}
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
                            <span className="animate-spin">⏳</span>
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
