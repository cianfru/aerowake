import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FileText, ChevronRight, ChevronLeft, AlertTriangle,
  Plane, Clock, Shield, Loader2, Upload, Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useAnalyzeRoster } from '@/hooks/useAnalyzeRoster';
import { getDutyDetail } from '@/lib/api-client';
import { FatigueReport } from './report/FatigueReport';
import { format } from 'date-fns';
import type { DutyAnalysis } from '@/types/fatigue';

// ── Helpers ──────────────────────────────────────────────────

const riskColors: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  MODERATE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  EXTREME: 'bg-red-500/15 text-red-300 border-red-500/30',
};

/** Build full route chain: DOH → BOM → DOH (filters out DH/IR segments) */
function getRoute(duty: DutyAnalysis): string {
  const segs = (duty.flightSegments ?? []).filter(
    (s) => !s.isDeadhead && s.activityCode !== 'DH' && s.activityCode !== 'IR',
  );
  if (segs.length === 0) {
    if (duty.dutyType === 'simulator') return duty.trainingCode ?? 'Simulator';
    if (duty.dutyType === 'ground_training') return duty.trainingCode ?? 'Ground Training';
    return 'Duty';
  }
  // Collect airports in order, dedup consecutive duplicates
  const airports: string[] = [];
  for (const seg of segs) {
    if (seg.departure && airports[airports.length - 1] !== seg.departure) airports.push(seg.departure);
    if (seg.arrival && airports[airports.length - 1] !== seg.arrival) airports.push(seg.arrival);
  }
  return airports.join(' → ');
}

function groupByMonth(duties: DutyAnalysis[]): Map<string, DutyAnalysis[]> {
  const groups = new Map<string, DutyAnalysis[]>();
  for (const d of duties) {
    const key = format(new Date(d.date), 'MMMM yyyy');
    const arr = groups.get(key) ?? [];
    arr.push(d);
    groups.set(key, arr);
  }
  return groups;
}

// ── Component ───────────────────────────────────────────────

export function ReportsPage() {
  const { state, setActiveTab } = useAnalysis();
  const { runAnalysis, isAnalyzing } = useAnalyzeRoster();
  const [selectedDuty, setSelectedDuty] = useState<DutyAnalysis | null>(null);
  const [detailedDuty, setDetailedDuty] = useState<DutyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const duties = state.analysisResults?.duties ?? [];
  const analysisId = state.analysisResults?.analysisId;
  const hasFile = !!state.uploadedFile;

  // Sorted flat list for prev/next navigation
  const sortedDuties = useMemo(() =>
    [...duties].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  [duties]);

  // Group duties by month
  const grouped = useMemo(() => groupByMonth(sortedDuties), [sortedDuties]);

  // Current index in sorted list
  const selectedIndex = useMemo(() => {
    if (!selectedDuty) return -1;
    return sortedDuties.findIndex((d) => d.dutyId === selectedDuty.dutyId);
  }, [selectedDuty, sortedDuties]);

  // Select a duty — set both states synchronously to avoid race conditions
  const selectDuty = useCallback((duty: DutyAnalysis | null) => {
    setSelectedDuty(duty);
    setDetailedDuty(duty); // immediate — useEffect will enrich with timeline
  }, []);

  const goToPrev = useCallback(() => {
    if (selectedIndex > 0) selectDuty(sortedDuties[selectedIndex - 1]);
  }, [selectedIndex, sortedDuties, selectDuty]);

  const goToNext = useCallback(() => {
    if (selectedIndex < sortedDuties.length - 1) selectDuty(sortedDuties[selectedIndex + 1]);
  }, [selectedIndex, sortedDuties, selectDuty]);

  // Fetch timeline data when a duty is selected
  useEffect(() => {
    if (!selectedDuty || !analysisId || !selectedDuty.dutyId) return;

    let cancelled = false;
    setLoading(true);

    getDutyDetail(analysisId, selectedDuty.dutyId)
      .then((detail) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawTimeline = detail?.timeline ?? detail?.timeline_points ?? detail?.timelinePoints;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timelinePoints = Array.isArray(rawTimeline) ? rawTimeline.map((pt: any) => ({
          hours_on_duty: pt.hours_on_duty ?? 0,
          time_on_task_penalty: pt.time_on_task_penalty ?? 0,
          sleep_inertia: pt.sleep_inertia ?? 0,
          sleep_pressure: pt.sleep_pressure ?? 0,
          circadian: pt.circadian ?? 0,
          performance: pt.performance,
          is_in_rest: pt.is_in_rest ?? false,
          flight_phase: pt.flight_phase ?? null,
          is_critical: pt.is_critical ?? false,
          timestamp: pt.timestamp,
          timestamp_local: pt.timestamp_local,
          debt_penalty: pt.debt_penalty,
          hypoxia_factor: pt.hypoxia_factor,
          pvt_lapses: pt.pvt_lapses,
          microsleep_probability: pt.microsleep_probability,
        })) : undefined;

        setDetailedDuty({
          ...selectedDuty,
          timelinePoints: timelinePoints ?? selectedDuty.timelinePoints,
        });
      })
      .catch((err) => {
        console.error('Failed to fetch duty detail:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDuty, analysisId]);

  // ── Report view ────────────────────────────────────────────
  if (selectedDuty) {
    const hasPrev = selectedIndex > 0;
    const hasNext = selectedIndex < sortedDuties.length - 1;

    return (
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading detailed analysis…
          </div>
        )}
        <FatigueReport
          duty={detailedDuty ?? selectedDuty}
          analysisId={analysisId}
          onBack={() => selectDuty(null)}
        />

        {/* Prev / Next navigation */}
        {sortedDuties.length > 1 && (
          <div className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3">
            <div className="mx-auto max-w-4xl flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasPrev}
                onClick={goToPrev}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous Duty</span>
                <span className="sm:hidden">Prev</span>
              </Button>

              <span className="text-xs text-muted-foreground">
                {selectedIndex + 1} / {sortedDuties.length}
              </span>

              <Button
                variant="ghost"
                size="sm"
                disabled={!hasNext}
                onClick={goToNext}
                className="gap-1.5"
              >
                <span className="hidden sm:inline">Next Duty</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────
  if (duties.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-2xl bg-secondary/30 p-6 mb-6">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            {hasFile && !state.analysisResults ? (
              /* File uploaded but not yet analyzed */
              <>
                <h2 className="text-xl font-semibold mb-2">Ready to Analyze</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Your roster is uploaded. Run the analysis to generate fatigue reports for every duty.
                </p>
                <Button
                  variant="glow"
                  size="sm"
                  onClick={() => runAnalysis()}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
                  ) : (
                    <><Play className="h-4 w-4 mr-2" /> Run Analysis</>
                  )}
                </Button>
              </>
            ) : (
              /* No file uploaded */
              <>
                <h2 className="text-xl font-semibold mb-2">No Reports Yet</h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Upload a roster to generate SMS-ready fatigue reports for every duty.
                  Each report includes risk assessment, impairment equivalences, and mitigation recommendations.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('rosters')}
                >
                  <Upload className="h-4 w-4 mr-2" /> Go to Rosters
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            SMS Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {duties.length} fatigue {duties.length === 1 ? 'report' : 'reports'} available
            {state.analysisResults?.pilotName && (
              <> &middot; {state.analysisResults.pilotName}</>
            )}
          </p>
        </div>

        {/* Grouped duty list */}
        {Array.from(grouped.entries()).map(([month, monthDuties]) => (
          <div key={month}>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {month}
            </h2>
            <div className="space-y-2">
              {monthDuties.map((duty, i) => {
                const operatingSegs = (duty.flightSegments ?? []).filter(
                  (s) => !s.isDeadhead && s.activityCode !== 'DH' && s.activityCode !== 'IR',
                );
                const isMultiSector = operatingSegs.length > 1;

                return (
                  <Card
                    key={duty.dutyId ?? `${duty.dateString}-${i}`}
                    variant="glass"
                    className={`transition-all duration-200 ${isMultiSector ? '' : 'cursor-pointer hover:bg-secondary/40 hover:border-primary/20'}`}
                    onClick={isMultiSector ? undefined : () => selectDuty(duty)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      {/* Duty header row */}
                      <div className="flex items-center gap-3">
                        {/* Date block */}
                        <div className="flex-shrink-0 text-center w-12">
                          <div className="text-lg font-bold leading-tight">
                            {format(new Date(duty.date), 'd')}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {duty.dayOfWeek?.slice(0, 3)}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-10 bg-border/50" />

                        {/* Route + info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {duty.dutyType === 'simulator' ? (
                              <Shield className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
                            ) : duty.dutyType === 'ground_training' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            ) : (
                              <Plane className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">
                              {getRoute(duty)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {duty.reportTimeLocal && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duty.reportTimeLocal}
                              </span>
                            )}
                            {duty.dutyHours > 0 && (
                              <span>{duty.dutyHours.toFixed(1)}h duty</span>
                            )}
                            {duty.sectors > 0 && (
                              <span className="hidden sm:inline">{duty.sectors} sector{duty.sectors !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>

                        {/* Performance + risk */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-mono font-semibold">
                              {Math.round(duty.minPerformance)}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">min perf</div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 ${riskColors[duty.overallRisk] ?? ''}`}
                          >
                            {duty.overallRisk}
                          </Badge>
                          {!isMultiSector && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Per-sector sub-rows for multi-sector duties */}
                      {isMultiSector && (
                        <div className="mt-3 ml-[3.75rem] border-t border-border/30 pt-2 space-y-1">
                          {operatingSegs.map((seg, idx) => (
                            <div
                              key={`${duty.dutyId}-seg-${idx}`}
                              className="flex items-center gap-3 px-2 py-1.5 -mx-1 rounded-md cursor-pointer transition-colors hover:bg-secondary/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectDuty(duty);
                              }}
                            >
                              <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">
                                {idx + 1}
                              </span>
                              <Plane className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs font-medium text-muted-foreground w-16 flex-shrink-0 truncate">
                                {seg.flightNumber || `Sector ${idx + 1}`}
                              </span>
                              <span className="text-xs flex-1 truncate">
                                {seg.departure} → {seg.arrival}
                              </span>
                              <span className="text-xs font-mono flex-shrink-0">
                                {Math.round(seg.performance)}%
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
