import { useState } from 'react';
import { Header } from '@/components/fatigue/Header';
import { Footer } from '@/components/fatigue/Footer';
import { DashboardContent } from '@/components/fatigue/DashboardContent';
import { InsightsContent } from '@/components/fatigue/InsightsContent';
import { LearnPage } from '@/components/fatigue/LearnPage';
import { AboutPage } from '@/components/fatigue/AboutPage';
import { LandingPage } from '@/components/landing/LandingPage';
import { AuroraBackground } from '@/components/ui/aurora-background';

import { PilotSettings, UploadedFile, AnalysisResults, DutyAnalysis } from '@/types/fatigue';
import { mockAnalysisResults } from '@/data/mockAnalysisData';
import { useTheme } from '@/hooks/useTheme';
import { analyzeRoster } from '@/lib/api-client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const Index = () => {
  const [showLanding, setShowLanding] = useState(true);
  const { theme, setTheme } = useTheme();

  const isoToHHmm = (iso: string) => {
    if (!iso) return '';
    if (iso.length >= 16 && iso.includes('T')) return iso.slice(11, 16);
    try {
      return format(parseISO(iso), 'HH:mm');
    } catch {
      return iso;
    }
  };

  // Extract HH:mm from ISO timestamp and append 'Z' for Zulu time display
  const isoToZulu = (iso: string) => {
    const hhmm = isoToHHmm(iso);
    return hhmm ? `${hhmm}Z` : '';
  };

  // Calculate per-segment performance based on temporal position within duty
  // This accounts for cumulative fatigue and time-on-task degradation
  const calculateSegmentPerformances = (duty: {
    segments: Array<{ departure_time: string; arrival_time: string; block_hours?: number }>;
    report_time_utc: string;
    min_performance: number;
    avg_performance: number;
    landing_performance: number | null;
    duty_hours: number;
  }): number[] => {
    if (duty.segments.length === 0) return [];
    if (duty.segments.length === 1) {
      return [duty.avg_performance];
    }

    const parseIsoToDate = (iso: string): Date | null => {
      try {
        return parseISO(iso);
      } catch {
        return null;
      }
    };

    const reportTime = parseIsoToDate(duty.report_time_utc);
    if (!reportTime) {
      return duty.segments.map(() => duty.avg_performance);
    }

    const segmentEndHours: number[] = [];
    let cumulativeHours = 0;

    duty.segments.forEach((seg) => {
      const arrivalTime = parseIsoToDate(seg.arrival_time);
      if (arrivalTime) {
        const hoursFromReport = (arrivalTime.getTime() - reportTime.getTime()) / (1000 * 60 * 60);
        segmentEndHours.push(hoursFromReport);
      } else {
        const blockHours = seg.block_hours || 1;
        cumulativeHours += blockHours + 0.5;
        segmentEndHours.push(cumulativeHours);
      }
    });

    const finalLanding = duty.landing_performance ?? duty.min_performance;
    const totalDutyHours = duty.duty_hours;
    const performanceDrop = duty.avg_performance - finalLanding;
    const estimatedStartPerf = Math.min(100, duty.avg_performance + performanceDrop * 0.5);

    return segmentEndHours.map((hoursElapsed) => {
      const fraction = totalDutyHours > 0 ? hoursElapsed / totalDutyHours : 0;
      const performance = estimatedStartPerf - (estimatedStartPerf - finalLanding) * fraction;
      return Math.max(0, Math.min(100, performance));
    });
  };

  const [settings, setSettings] = useState<PilotSettings>({
    pilotId: 'P12345',
    homeBase: 'DOH',
    analysisType: 'single',
    selectedMonth: new Date(2026, 1, 1),
    theme: 'dark',
    configPreset: 'easa-default',
    crewSet: 'crew_b',
  });

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [actualFileObject, setActualFileObject] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [selectedDuty, setSelectedDuty] = useState<DutyAnalysis | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');
  const [dutyCrewOverrides, setDutyCrewOverrides] = useState<Map<string, 'crew_a' | 'crew_b'>>(new Map());

  const handleSettingsChange = (newSettings: Partial<PilotSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.theme) {
        setTheme(newSettings.theme);
      }
      return updated;
    });
  };

  const handleDutyCrewChange = (dutyId: string, crewSet: 'crew_a' | 'crew_b') => {
    setDutyCrewOverrides(prev => {
      const updated = new Map(prev);
      // If selecting global setting, remove override
      if (crewSet === settings.crewSet) {
        updated.delete(dutyId);
      } else {
        updated.set(dutyId, crewSet);
      }
      return updated;
    });
  };

  const handleFileUpload = (file: UploadedFile, actualFile: File) => {
    setUploadedFile(file);
    setActualFileObject(actualFile);
    setAnalysisResults(null);
    setSelectedDuty(null);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setActualFileObject(null);
    setAnalysisResults(null);
    setSelectedDuty(null);
    setDutyCrewOverrides(new Map());
  };

  const handleRunAnalysis = async () => {
    if (!uploadedFile || !actualFileObject) {
      toast.error('Please upload a roster file first');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      const result = await analyzeRoster(
        actualFileObject,
        settings.pilotId,
        settings.homeBase,
        settings.configPreset,
        settings.crewSet,
        dutyCrewOverrides
      );

      const analysisMonth = result.duties.length > 0 
        ? parseISO(result.duties[0].date) 
        : settings.selectedMonth;

      const parseTimeToMinutes = (t: string | undefined): number | null => {
        if (!t) return null;
        const isoMatch = t.match(/T(\d{2}):(\d{2})/);
        if (isoMatch) {
          const h = Number(isoMatch[1]);
          const m = Number(isoMatch[2]);
          if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
        }
        const parts = t.split(':').map(Number);
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          return parts[0] * 60 + parts[1];
        }
        return null;
      };

      const computeSegmentBlockHours = (seg: { block_hours?: number; departure_time_local?: string; arrival_time_local?: string; departure_time?: string; arrival_time?: string }) => {
        if (typeof seg.block_hours === 'number' && Number.isFinite(seg.block_hours) && seg.block_hours > 0) return seg.block_hours;
        const dep = parseTimeToMinutes(seg.departure_time_local) ?? parseTimeToMinutes(seg.departure_time);
        const arr = parseTimeToMinutes(seg.arrival_time_local) ?? parseTimeToMinutes(seg.arrival_time);
        if (dep == null || arr == null) return 0;
        let diff = arr - dep;
        if (diff < 0) diff += 24 * 60;
        return Math.max(0, diff / 60);
      };

      const computedBlockHoursFromSegments = result.duties.reduce(
        (sum, d) => sum + d.segments.reduce((s, seg) => s + computeSegmentBlockHours(seg), 0),
        0
      );

      setAnalysisResults({
        generatedAt: new Date(),
        month: analysisMonth,
        analysisId: result.analysis_id || undefined,
        pilotId: result.pilot_id || undefined,
        pilotName: result.pilot_name || undefined,
        pilotBase: result.pilot_base || undefined,
        pilotAircraft: result.pilot_aircraft || undefined,
        statistics: {
          totalDuties: result.total_duties,
          totalSectors: result.total_sectors,
          totalDutyHours: result.total_duty_hours,
          totalBlockHours:
            Number.isFinite(result.total_block_hours) && result.total_block_hours > 0
              ? result.total_block_hours
              : computedBlockHoursFromSegments,
          highRiskDuties: result.high_risk_duties,
          criticalRiskDuties: result.critical_risk_duties,
          maxSleepDebt: result.max_sleep_debt,
          totalPinchEvents: result.total_pinch_events || 0,
          avgSleepPerNight: result.avg_sleep_per_night || 0,
          worstPerformance: result.worst_performance || 0,
          worstDutyId: result.worst_duty_id || undefined,
          totalUlrDuties: result.total_ulr_duties || 0,
          totalAugmentedDuties: result.total_augmented_duties || 0,
          ulrViolations: result.ulr_violations || [],
        },
        restDaysSleep: result.rest_days_sleep?.map(restDay => ({
          date: parseISO(restDay.date),
          sleepBlocks: restDay.sleep_blocks.map(block => ({
            sleepStartTime: block.sleep_start_time,
            sleepEndTime: block.sleep_end_time,
            sleepStartIso: block.sleep_start_iso,
            sleepEndIso: block.sleep_end_iso,
            sleepType: block.sleep_type,
            durationHours: block.duration_hours,
            effectiveHours: block.effective_hours,
            qualityFactor: block.quality_factor,
            sleepStartDayHomeTz: block.sleep_start_day_home_tz ?? undefined,
            sleepStartHourHomeTz: block.sleep_start_hour_home_tz ?? undefined,
            sleepEndDayHomeTz: block.sleep_end_day_home_tz ?? undefined,
            sleepEndHourHomeTz: block.sleep_end_hour_home_tz ?? undefined,
            sleepStartTimeHomeTz: block.sleep_start_time_home_tz ?? undefined,
            sleepEndTimeHomeTz: block.sleep_end_time_home_tz ?? undefined,
            locationTimezone: block.location_timezone ?? undefined,
            environment: block.environment ?? undefined,
            sleepStartTimeLocationTz: block.sleep_start_time_location_tz ?? undefined,
            sleepEndTimeLocationTz: block.sleep_end_time_location_tz ?? undefined,
            sleepStartDay: block.sleep_start_day ?? undefined,
            sleepStartHour: block.sleep_start_hour ?? undefined,
            sleepEndDay: block.sleep_end_day ?? undefined,
            sleepEndHour: block.sleep_end_hour ?? undefined,
            startUtc: block.start_utc ?? undefined,
            endUtc: block.end_utc ?? undefined,
          })),
          totalSleepHours: restDay.total_sleep_hours,
          effectiveSleepHours: restDay.effective_sleep_hours,
          sleepEfficiency: restDay.sleep_efficiency,
          strategyType: restDay.strategy_type,
          confidence: restDay.confidence,
          explanation: restDay.explanation,
          confidenceBasis: restDay.confidence_basis,
          qualityFactors: restDay.quality_factors,
          references: restDay.references,
        })),
        bodyClockTimeline: result.body_clock_timeline?.map(entry => ({
          timestampUtc: entry.timestamp_utc,
          phaseShiftHours: entry.phase_shift_hours,
          referenceTimezone: entry.reference_timezone,
        })),
        duties: result.duties.map(duty => {
          const segmentPerformances = calculateSegmentPerformances(duty);
          const sleep = duty.sleep_quality ?? duty.sleep_estimate;
          const sleepEnvironment = duty.sleep_environment ?? sleep?.sleep_environment;
          const sleepQuality = duty.sleep_quality_label ?? sleep?.sleep_quality_label;

          return {
            dutyId: duty.duty_id,
            date: parseISO(duty.date),
            dateString: duty.date,
            dayOfWeek: format(parseISO(duty.date), 'EEE'),
            reportTimeUtc: duty.report_time_utc,
            reportTimeLocal: duty.report_time_local,
            releaseTimeLocal: duty.release_time_local,
            dutyHours: duty.duty_hours ?? 0,
            blockHours: (duty.segments ?? []).reduce((sum, seg) => sum + computeSegmentBlockHours(seg), 0),
            sectors: duty.sectors ?? 0,
            minPerformance: duty.min_performance ?? 0,
            avgPerformance: duty.avg_performance ?? 0,
            landingPerformance: duty.landing_performance ?? duty.min_performance ?? 0,
            sleepDebt: duty.sleep_debt ?? 0,
            woclExposure: duty.wocl_hours ?? 0,
            priorSleep: duty.prior_sleep ?? 0,
            overallRisk: (duty.risk_level ?? 'unknown').toUpperCase() as 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
            minPerformanceRisk: (duty.risk_level ?? 'unknown').toUpperCase() as 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
            landingRisk: (duty.risk_level ?? 'unknown').toUpperCase() as 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
            smsReportable: duty.is_reportable,
            maxFdpHours: duty.max_fdp_hours,
            extendedFdpHours: duty.extended_fdp_hours,
            usedDiscretion: duty.used_discretion,
            circadianPhaseShiftValue: duty.circadian_phase_shift ?? undefined,
            sleepEnvironment,
            sleepQuality,
            sleepEstimate: sleep ? (() => {
              // Use typed fields directly — no unsafe casts needed.
              const firstBlock = sleep.sleep_blocks?.[0];
              const sleepStartIso = sleep.sleep_start_iso ?? firstBlock?.sleep_start_iso;
              const sleepEndIso = sleep.sleep_end_iso ?? firstBlock?.sleep_end_iso;

              let sleepStartDay = sleep.sleep_start_day ?? undefined;
              let sleepStartHour = sleep.sleep_start_hour ?? undefined;
              let sleepEndDay = sleep.sleep_end_day ?? undefined;
              let sleepEndHour = sleep.sleep_end_hour ?? undefined;

              // Home base timezone fields (for chronogram positioning)
              const sleepStartDayHomeTz = sleep.sleep_start_day_home_tz ?? undefined;
              const sleepStartHourHomeTz = sleep.sleep_start_hour_home_tz ?? undefined;
              const sleepEndDayHomeTz = sleep.sleep_end_day_home_tz ?? undefined;
              const sleepEndHourHomeTz = sleep.sleep_end_hour_home_tz ?? undefined;
              const sleepStartTimeHomeTz = sleep.sleep_start_time_home_tz ?? undefined;
              const sleepEndTimeHomeTz = sleep.sleep_end_time_home_tz ?? undefined;
              const locationTimezone = sleep.location_timezone ?? undefined;
              const sleepEnvironment2 = sleep.environment ?? undefined;

              const parseIsoToDayHour = (iso: string | undefined | null): { day: number; hour: number } | null => {
                if (!iso) return null;
                const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
                if (m) return { day: Number(m[3]), hour: Number(m[4]) + Number(m[5]) / 60 };
                return null;
              };

              if (sleepStartDay == null && sleepStartIso) {
                const parsed = parseIsoToDayHour(sleepStartIso);
                if (parsed) { sleepStartDay = parsed.day; sleepStartHour = parsed.hour; }
              }
              if (sleepEndDay == null && sleepEndIso) {
                const parsed = parseIsoToDayHour(sleepEndIso);
                if (parsed) { sleepEndDay = parsed.day; sleepEndHour = parsed.hour; }
              }

              const explanation = sleep.explanation;
              const confidenceBasis = sleep.confidence_basis;
              const qualityFactors = sleep.quality_factors;
              const references = sleep.references;

              return {
                totalSleepHours: sleep.total_sleep_hours,
                effectiveSleepHours: sleep.effective_sleep_hours,
                sleepEfficiency: sleep.sleep_efficiency,
                woclOverlapHours: sleep.wocl_overlap_hours,
                sleepStrategy: sleep.sleep_strategy,
                confidence: sleep.confidence,
                warnings: sleep.warnings,
                sleepStartTime: sleep.sleep_start_time,
                sleepEndTime: sleep.sleep_end_time,
                sleepStartIso,
                sleepEndIso,
                sleepStartDay,
                sleepStartHour,
                sleepEndDay,
                sleepEndHour,
                sleepStartDayHomeTz,
                sleepStartHourHomeTz,
                sleepEndDayHomeTz,
                sleepEndHourHomeTz,
                sleepStartTimeHomeTz,
                sleepEndTimeHomeTz,
                locationTimezone,
                environment: sleepEnvironment2,
                startUtc: sleep.start_utc ?? undefined,
                endUtc: sleep.end_utc ?? undefined,
                // Pass individual sleep blocks for split/nap visualization
                sleepBlocks: (sleep.sleep_blocks ?? []).map((blk: any) => ({
                  sleepStartDayHomeTz: blk.sleep_start_day_home_tz ?? blk.sleep_start_day ?? undefined,
                  sleepStartHourHomeTz: blk.sleep_start_hour_home_tz ?? blk.sleep_start_hour ?? undefined,
                  sleepEndDayHomeTz: blk.sleep_end_day_home_tz ?? blk.sleep_end_day ?? undefined,
                  sleepEndHourHomeTz: blk.sleep_end_hour_home_tz ?? blk.sleep_end_hour ?? undefined,
                  sleepStartIso: blk.sleep_start_iso ?? undefined,
                  sleepEndIso: blk.sleep_end_iso ?? undefined,
                  startUtc: blk.start_utc ?? undefined,
                  endUtc: blk.end_utc ?? undefined,
                  sleepType: blk.sleep_type ?? 'main',
                  durationHours: blk.duration_hours ?? 0,
                  effectiveHours: blk.effective_hours ?? 0,
                  qualityFactor: blk.quality_factor ?? 0.9,
                  environment: blk.environment ?? null,
                })),
                explanation,
                confidenceBasis,
                qualityFactors,
                references,
              };
            })() : undefined,
            // ULR / Augmented crew transforms
            crewComposition: duty.crew_composition || 'standard',
            restFacilityClass: duty.rest_facility_class || null,
            isUlr: duty.is_ulr || false,
            acclimatizationState: duty.acclimatization_state || 'acclimatized',
            ulrCompliance: duty.ulr_compliance ? {
              isUlr: duty.ulr_compliance.is_ulr,
              fdpWithinLimit: duty.ulr_compliance.fdp_within_limit,
              maxPlannedFdp: duty.ulr_compliance.max_planned_fdp,
              restPeriodsValid: duty.ulr_compliance.rest_periods_valid,
              preUlrRestCompliant: duty.ulr_compliance.pre_ulr_rest_compliant,
              postUlrRestCompliant: duty.ulr_compliance.post_ulr_rest_compliant,
              monthlyUlrCount: duty.ulr_compliance.monthly_ulr_count,
              monthlyLimit: duty.ulr_compliance.monthly_limit,
              violations: duty.ulr_compliance.violations,
              warnings: duty.ulr_compliance.warnings,
            } : null,
            inflightRestBlocks: (duty.inflight_rest_blocks || []).map(block => ({
              startUtc: block.start_utc,
              endUtc: block.end_utc,
              durationHours: block.duration_hours,
              effectiveSleepHours: block.effective_sleep_hours,
              crewMemberId: block.crew_member_id,
              crewSet: block.crew_set,
              isDuringWocl: block.is_during_wocl,
            })),
            returnToDeckPerformance: duty.return_to_deck_performance ?? null,
            preDutyAwakeHours: duty.pre_duty_awake_hours ?? 0,

            flightSegments: (duty.segments ?? []).map((seg, idx) => ({
              flightNumber: seg.flight_number,
              departure: seg.departure,
              arrival: seg.arrival,
              departureTime: seg.departure_time_home_tz || seg.departure_time_local,
              arrivalTime: seg.arrival_time_home_tz || seg.arrival_time_local,
              departureTimeUtc: isoToZulu(seg.departure_time),
              arrivalTimeUtc: isoToZulu(seg.arrival_time),
              departureTimeUtcIso: seg.departure_time,  // Full ISO 8601 UTC
              arrivalTimeUtcIso: seg.arrival_time,       // Full ISO 8601 UTC
              blockHours: seg.block_hours,
              performance: segmentPerformances[idx] || duty.avg_performance,
              departureTimeAirportLocal: seg.departure_time_airport_local,
              arrivalTimeAirportLocal: seg.arrival_time_airport_local,
              departureTimezone: seg.departure_timezone,
              arrivalTimezone: seg.arrival_timezone,
              departureUtcOffset: seg.departure_utc_offset,
              arrivalUtcOffset: seg.arrival_utc_offset,
              activityCode: seg.activity_code ?? null,
              isDeadhead: seg.is_deadhead ?? false,
            })),
          };
        }),
        homeBaseTimezone: result.home_base_timezone ?? undefined,
      });
      
      toast.success('Analysis complete!');
      
    } catch (error) {
      console.error('Analysis failed:', error);
      const errMsg = (error as Error).message;
      console.error('[Analysis] API call failed:', errMsg, error);
      toast.error('Analysis failed: ' + errMsg);
      // Do NOT fall back to mock data — let the user see the failure
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDutySelect = (duty: DutyAnalysis) => {
    setSelectedDuty(duty);
    setDrawerOpen(true);
  };

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <AuroraBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header 
          theme={settings.theme} 
          onThemeChange={(theme) => handleSettingsChange({ theme })}
          onMenuToggle={() => setSidebarOpen(true)}
          showMenuButton={true}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        {activeTab === 'analysis' && (
          <div className="flex-1">
            <DashboardContent
              settings={settings}
              onSettingsChange={handleSettingsChange}
              uploadedFile={uploadedFile}
              onFileUpload={handleFileUpload}
              onRemoveFile={handleRemoveFile}
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
              analysisResults={analysisResults}
              selectedDuty={selectedDuty}
              onDutySelect={handleDutySelect}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={setDrawerOpen}
              sidebarOpen={sidebarOpen}
              onSidebarOpenChange={setSidebarOpen}
              globalCrewSet={settings.crewSet}
              dutyCrewOverride={dutyCrewOverrides.get(selectedDuty?.dutyId || '')}
              onCrewChange={handleDutyCrewChange}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="flex-1">
            <InsightsContent 
              analysisResults={analysisResults} 
              settings={settings} 
            />
          </div>
        )}

        {activeTab === 'learn' && (
          <div className="flex-1">
            <LearnPage />
          </div>
        )}

        {activeTab === 'about' && (
          <div className="flex-1">
            <AboutPage />
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
};

export default Index;
