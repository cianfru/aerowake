import { useEffect, useMemo, useState } from 'react';
import {
  FileText, ChevronRight, AlertTriangle,
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
};

function getRoute(duty: DutyAnalysis): string {
  const segs = duty.flightSegments ?? [];
  if (segs.length === 0) {
    if (duty.dutyType === 'simulator') return duty.trainingCode ?? 'Simulator';
    if (duty.dutyType === 'ground_training') return duty.trainingCode ?? 'Ground Training';
    return 'Duty';
  }
  const origin = segs[0]?.origin ?? '';
  const dest = segs[segs.length - 1]?.destination ?? '';
  if (segs.length === 1) return `${origin} → ${dest}`;
  return `${origin} → ${dest} (${segs.length} sectors)`;
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

  // Group duties by month
  const grouped = useMemo(() => {
    const sorted = [...duties].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return groupByMonth(sorted);
  }, [duties]);

  // Fetch timeline data when a duty is selected
  useEffect(() => {
    if (!selectedDuty) {
      setDetailedDuty(null);
      return;
    }

    let cancelled = false;
    setDetailedDuty(selectedDuty);

    if (!analysisId || !selectedDuty.dutyId) return;

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
  if (detailedDuty && selectedDuty) {
    return (
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading detailed analysis…
          </div>
        )}
        <FatigueReport
          duty={detailedDuty}
          analysisId={analysisId}
          onBack={() => setSelectedDuty(null)}
        />
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
              {monthDuties.map((duty, i) => (
                <Card
                  key={duty.dutyId ?? `${duty.dateString}-${i}`}
                  variant="glass"
                  className="cursor-pointer transition-all duration-200 hover:bg-secondary/40 hover:border-primary/20"
                  onClick={() => setSelectedDuty(duty)}
                >
                  <CardContent className="p-3 sm:p-4">
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
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
