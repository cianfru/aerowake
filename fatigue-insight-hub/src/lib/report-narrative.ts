/**
 * Narrative text generation engine for the Fatigue Report Generator.
 *
 * Converts biomathematical model data into professional, SMS-investigator-grade
 * narrative paragraphs. Research provides context; model estimates and suggested
 * countermeasures require individual review and applicable operating procedures.
 */

import type { DutyAnalysis, TimelinePoint } from '@/types/fatigue';
import {
  decomposePerformance,
  getKSSLabel,
  DECOMPOSITION_FACTOR_LABELS,
  type PerformanceDecomposition,
} from '@/lib/fatigue-calculations';
import {
  assessPriorSleep,
  sleepDebtSeverity,
  assessWOCLExposure,
} from '@/lib/report-impairment';
import {
  DEFAULT_RISK_THRESHOLDS,
  classifyPerformance,
  formatKssWithLabel,
  indexToKss,
  isElevatedRisk,
  kssLabel,
  resolveKss,
  resolveThresholds,
} from '@/lib/risk-scale';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  duty: DutyAnalysis;
  timeline: TimelinePoint[];
  worstPoint: TimelinePoint | null;
  decomposition: PerformanceDecomposition | null;
  executiveSummary: string;
  trajectoryNarrative: string;
  preDutyNarrative: string;
  mitigations: Mitigation[];
  criticalPhaseAnalysis: CriticalPhaseData[];
  thresholdCrossings: ThresholdCrossing[];
}

export interface Mitigation {
  priority: number;
  category: 'SLEEP' | 'NAPPING' | 'MONITORING' | 'CAFFEINE' | 'SCHEDULING' | 'CREW_REST' | 'GENERAL';
  title: string;
  text: string;
  reference: string;
  sourceKeys?: string[];
}

export interface CriticalPhaseData {
  sectorIndex: number;
  flightNumber: string;
  departure: string;
  arrival: string;
  phase: string;
  performance: number;
  kss: number;
  kssLabel: string;
  /** Predicted KSS for the 90th-percentile pilot (backend), if available. */
  kss90: number | null;
  /** P(KSS ≥ 7), 0–1 (backend), if available. */
  pSevere: number | null;
  hoursAwake: number | null;
  pvtLapses: number | null;
  microsleepProbability: number | null;
  hoursOnDuty: number;
  dominantFactor: string;
  timestamp?: string;
}

export interface ThresholdCrossing {
  threshold: number;
  thresholdLabel: string;
  crossedAt: number; // hours on duty
  timestamp?: string;
  performance: number;
}

// ---------------------------------------------------------------------------
// Helper: find worst timeline point
// ---------------------------------------------------------------------------

export function findWorstPoint(timeline: TimelinePoint[]): TimelinePoint | null {
  timeline = (timeline ?? []).filter(p => !p.is_in_rest && Number.isFinite(p.performance));
  if (timeline.length === 0) return null;
  return timeline.reduce((worst, pt) =>
    (pt.performance ?? 100) < (worst.performance ?? 100) ? pt : worst,
    timeline[0],
  );
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

/**
 * Generate a 2-3 sentence executive summary for the report.
 *
 * This is the first thing an SMS investigator reads. It must answer:
 * 1. How severe was the predicted fatigue?
 * 2. When did the worst point occur?
 * 3. What caused it?
 * 4. What's the key recommendation?
 */
export function generateExecutiveSummary(
  duty: DutyAnalysis,
  worstPoint: TimelinePoint | null,
  decomp: PerformanceDecomposition | null,
): string {
  const perf = worstPoint?.performance ?? duty.minPerformance;
  if (perf == null || !Number.isFinite(perf)) return 'Prediction unavailable. Review the inputs before generating a report.';
  const worstKss = resolveKss(worstPoint?.kss ?? duty.maxKss, perf) ?? indexToKss(perf);
  const landing = duty.landingPerformance;
  const landingKss = landing != null && Number.isFinite(landing) ? resolveKss(duty.landingKss, landing) : null;
  return `Highest predicted sleepiness while operating: ${formatKssWithLabel(worstKss)} (index ${perf.toFixed(0)}). ` +
    (landingKss != null ? `At landing: ${formatKssWithLabel(landingKss)}. ` : '') +
    (duty.maxKss90 != null ? `90th-percentile model reference: KSS ${duty.maxKss90.toFixed(1)}. ` : '') +
    (decomp ? `Main driver at the worst point: ${DECOMPOSITION_FACTOR_LABELS[decomp.dominantFactor].toLowerCase()}. ` : '') +
    `Duty classification: ${(duty.overallRisk ?? 'unknown').toLowerCase()}, for the duty headline window; the landing prediction is reported separately. ` +
    `This is a group-average model prediction, not a measured fatigue state, a probability of error or a fitness-to-fly determination. The source study’s residual standard deviation is 1.42 KSS, not a personal error bound. Sleep inputs must be reviewed. ` +
    (duty.modelVersion ? `Model: ${duty.modelVersion} (Three Process Model, Ingre et al. 2014). Independent validation of this implementation is pending.` :
      'Legacy result: model version and thresholds may be unavailable. Recalculate before comparison.');
}

// ---------------------------------------------------------------------------
// Pre-Duty State Narrative
// ---------------------------------------------------------------------------

/**
 * Generate a narrative describing the pilot's fatigue state before the duty.
 */
export function generatePreDutyNarrative(duty: DutyAnalysis): string {
  const parts: string[] = [];

  // Time awake
  if (duty.preDutyAwakeHours != null) {
    const awakeImpairment = {description: 'Wake duration is estimated from the sleep inputs; verify actual sleep and naps.'};
    parts.push(
      `The pilot had been awake for approximately ${duty.preDutyAwakeHours.toFixed(1)} hours at the start of duty. ` +
      `${awakeImpairment.description}`,
    );
  }

  // Prior sleep
  if (duty.priorSleep != null) {
    const sleepAssessment = assessPriorSleep(duty.priorSleep);
    parts.push(sleepAssessment.description);
  }

  // Cumulative sleep debt
  if (duty.sleepDebt != null && duty.sleepDebt > 0.5) {
    const debtAssessment = sleepDebtSeverity(duty.sleepDebt);
    parts.push(debtAssessment.description);
  }

  // WOCL
  if (duty.woclExposure != null) {
    const woclAssessment = assessWOCLExposure(duty.woclExposure);
    if (woclAssessment.severity !== 'none') {
      parts.push(woclAssessment.description);
    }
  }

  // Acclimatization
  if (duty.acclimatizationState && duty.acclimatizationState !== 'acclimatized') {
    parts.push(
      `The pilot's acclimatization state is "${duty.acclimatizationState}", indicating the body clock ` +
      `may not be aligned with the local time zone. This can amplify circadian effects on alertness.`,
    );
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Fatigue Trajectory Narrative
// ---------------------------------------------------------------------------

/**
 * Generate a paragraph describing how performance evolved across the duty.
 */
export function generateTrajectoryNarrative(
  duty: DutyAnalysis,
  timeline: TimelinePoint[],
): string {
  const operating = timeline.filter(p => !p.is_in_rest && Number.isFinite(p.performance));
  if (operating.length < 2) return 'Insufficient operating timeline data.';
  const worst = findWorstPoint(operating)!;
  const startKss = resolveKss(operating[0].kss, operating[0].performance)!;
  const worstKss = resolveKss(worst.kss, worst.performance)!;
  return `Predicted sleepiness starts at KSS ${startKss.toFixed(1)} (${kssLabel(startKss).toLowerCase()}) and peaks at ` +
    `KSS ${worstKss.toFixed(1)} (${kssLabel(worstKss).toLowerCase()}) ${worst.hours_on_duty.toFixed(1)} hours after report` +
    (worst.flight_phase ? ` (${worst.flight_phase.replace(/_/g, ' ')})` : '') +
    (worst.hours_awake != null ? `, after about ${worst.hours_awake.toFixed(1)} h awake` : '') +
    '. Sleep/rest intervals are excluded. The 20–100 index equals 110 − 10·KSS; it is not a percentage of cognitive ability.';
}

// ---------------------------------------------------------------------------
// Threshold Crossings
// ---------------------------------------------------------------------------

export function findThresholdCrossings(timeline: TimelinePoint[], policy?: Record<string, [number, number]>): ThresholdCrossing[] {
  // Saved per-duty thresholds take precedence; otherwise the KSS band defaults.
  const bands = policy && Object.keys(policy).length > 0 ? policy : DEFAULT_RISK_THRESHOLDS;
  const nextBand: Record<string, string> = { low: 'moderate', moderate: 'high', high: 'critical', critical: 'extreme' };
  const thresholds = Object.entries(bands)
    .filter(([name, range]) => name !== 'extreme' && Array.isArray(range) && Number.isFinite(range[0]))
    .map(([name, range]) => ({
      value: range[0],
      label: `KSS ${indexToKss(range[0]).toFixed(1)} — entering ${nextBand[name] ?? 'next'} band`,
    }));

  const crossings: ThresholdCrossing[] = [];

  for (const t of thresholds) {
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i - 1].is_in_rest || timeline[i].is_in_rest) continue;
      const prev = timeline[i - 1].performance ?? 100;
      const curr = timeline[i].performance ?? 100;

      // Crossed below threshold (first time only)
      if (prev >= t.value && curr < t.value) {
        crossings.push({
          threshold: t.value,
          thresholdLabel: t.label,
          crossedAt: timeline[i].hours_on_duty,
          timestamp: timeline[i].timestamp_local ?? undefined,
          performance: curr,
        });
        break; // Only first crossing per threshold
      }
    }
  }

  return crossings;
}

// ---------------------------------------------------------------------------
// Critical Phase Analysis
// ---------------------------------------------------------------------------

/**
 * Extract performance data for each critical flight phase (approach, landing)
 * of each sector, matched to timeline points.
 */
export function analyzeCriticalPhases(
  duty: DutyAnalysis,
  timeline: TimelinePoint[],
): CriticalPhaseData[] {
  const results: CriticalPhaseData[] = [];

  if (!duty.flightSegments || duty.flightSegments.length === 0) return results;

  // ── Pre-compute per-sector landing clusters ──────────────────────
  // The backend assigns flight phases per-segment timing, so landing/approach/
  // descent points for each sector are separated by turnaround gaps (>30 min).
  // Group consecutive critical-phase points into clusters by hours_on_duty
  // proximity, then assign cluster[i] to segment[i].
  const criticalPhases = ['descent', 'landing', 'approach'];

  const allCriticalPts = timeline.filter(pt =>
    pt.flight_phase && criticalPhases.includes(pt.flight_phase) && pt.is_critical,
  );

  const clusters: TimelinePoint[][] = [];
  let curCluster: TimelinePoint[] = [];
  for (const pt of allCriticalPts) {
    if (
      curCluster.length > 0 &&
      pt.hours_on_duty - curCluster[curCluster.length - 1].hours_on_duty > 0.5
    ) {
      clusters.push(curCluster);
      curCluster = [];
    }
    curCluster.push(pt);
  }
  if (curCluster.length > 0) clusters.push(curCluster);

  // ── Iterate sectors, matching each to its landing cluster ────────
  let clusterIdx = 0;

  duty.flightSegments.forEach((segment, idx) => {
    // Skip deadhead and inflight rest segments
    if (segment.isDeadhead || segment.activityCode === 'DH' || segment.activityCode === 'IR') return;

    // Per-sector critical phase points (or empty if no matching cluster)
    const landingPoints = clusters[clusterIdx] ?? [];
    clusterIdx++;

    // Take the worst critical-phase point for this sector (or segment performance)
    const perfValue = segment.performance ?? duty.landingPerformance ?? duty.minPerformance ?? 100;
    const relevantPoint = landingPoints.length > 0
      ? landingPoints.reduce((w, pt) => (pt.performance ?? 100) < (w.performance ?? 100) ? pt : w)
      : null;

    const usePerf = relevantPoint?.performance ?? perfValue;
    const kss = resolveKss(relevantPoint?.kss, usePerf) ?? indexToKss(usePerf);

    // Decompose for dominant factor (sleep pressure vs circadian phase)
    let dominantFactor = 'multiple factors';
    if (relevantPoint) {
      const d = decomposePerformance({
        performance: relevantPoint.performance ?? 0,
        sleep_pressure: relevantPoint.sleep_pressure,
        circadian: relevantPoint.circadian,
        hours_on_duty: relevantPoint.hours_on_duty,
        kss: relevantPoint.kss,
      });
      dominantFactor = d.dominantFactor === 'circadian' ? 'Circadian phase' : 'Sleep pressure';
    }

    results.push({
      sectorIndex: idx + 1,
      flightNumber: segment.flightNumber,
      departure: segment.departure,
      arrival: segment.arrival,
      phase: relevantPoint?.flight_phase ?? 'landing',
      performance: usePerf,
      kss,
      kssLabel: getKSSLabel(kss).label,
      kss90: relevantPoint?.kss_90 ?? null,
      pSevere: relevantPoint?.p_severe_sleepiness ?? null,
      hoursAwake: relevantPoint?.hours_awake ?? null,
      pvtLapses: relevantPoint?.pvt_lapses ?? null,
      microsleepProbability: relevantPoint?.microsleep_probability ?? null,
      hoursOnDuty: relevantPoint?.hours_on_duty ?? 0,
      dominantFactor,
      timestamp: relevantPoint?.timestamp_local ?? segment.arrivalTime ?? undefined,
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// Mitigations
// ---------------------------------------------------------------------------

/**
 * Generate prioritized, rule-based fatigue mitigations.
 *
 * Each mitigation is specific, actionable, and references a scientific source.
 */
export function generateMitigations(
  duty: DutyAnalysis,
  timeline: TimelinePoint[],
): Mitigation[] {
  const mitigations: Mitigation[] = [];
  let priority = 1;

  const worst = findWorstPoint(timeline);
  const worstPerf = worst?.performance ?? duty.minPerformance ?? 100;
  const worstKss = resolveKss(worst?.kss ?? duty.maxKss, worstPerf) ?? indexToKss(worstPerf);
  const thresholds = resolveThresholds(duty.riskThresholds);

  // 1. Prior sleep insufficiency
  if (duty.priorSleep != null && duty.priorSleep < 6) {
    mitigations.push({
      priority: priority++,
      category: 'SLEEP',
      title: 'Prioritize Pre-Duty Sleep',
      text: `Modelled prior sleep is ${duty.priorSleep.toFixed(1)}h. Check this estimate against the sleep actually obtained. ` +
        `For future duties, protect sufficient time for your usual sleep need in a dark, quiet environment, including time to settle and wake up. ` +
        `If the sleep environment is suboptimal (hotel, layover), consider using earplugs and an eye mask to improve sleep quality.`,
      reference: 'Belenky et al., 2003; Rosekind et al., 1996',
      sourceKeys: ['belenky_2003', 'rosekind_1996'],
    });
  } else if (duty.priorSleep != null && duty.priorSleep < 7) {
    mitigations.push({
      priority: priority++,
      category: 'SLEEP',
      title: 'Extend Pre-Duty Sleep',
      text: `Modelled prior sleep is ${duty.priorSleep.toFixed(1)}h; confirm the duration and whether it meets your usual need. ` +
        `Consider whether the schedule allows a longer sleep opportunity. The model cannot guarantee a particular personal performance benefit.`,
      reference: 'Van Dongen et al., 2003',
      sourceKeys: ['van_dongen_2003'],
    });
  }

  // 2. Cumulative sleep debt recovery
  if (duty.sleepDebt != null && duty.sleepDebt > 4) {
    mitigations.push({
      priority: priority++,
      category: 'SLEEP',
      title: 'Address Cumulative Sleep Debt',
      text: `The model estimates ${duty.sleepDebt.toFixed(1)}h of sleep deficit. Verify sleep history and plan adequate recovery. ` +
        `Research shows that subjective sleepiness and measured performance can diverge during repeated sleep restriction; the ledger itself is an estimate.`,
      reference: 'Kitamura et al., 2016; Van Dongen et al., 2003',
      sourceKeys: ['kitamura_2016', 'van_dongen_2003'],
    });
  }

  // 3. WOCL exposure countermeasures
  if (duty.woclExposure != null && duty.woclExposure > 2) {
    mitigations.push({
      priority: priority++,
      category: 'NAPPING',
      title: 'Strategic Napping for WOCL Protection',
      text: `The duty includes ${duty.woclExposure.toFixed(1)}h in the modelled WOCL window, when maintaining alertness may be more difficult. ` +
        `Consider planned sleep or a nap before duty. In-flight controlled rest is appropriate only when explicitly permitted by your operator’s procedures. ` +
        `Follow the approved wake-up and task-resumption procedure. Sleep inertia varies and is not included in the KSS forecast; no fixed interval guarantees recovery.`,
      reference: 'Rosekind et al., 1994; Caldwell et al., 2009',
      sourceKeys: ['rosekind_1994', 'caldwell_2009'],
    });
  }

  // 4. Augmented crew / in-flight rest
  if (duty.crewComposition === 'augmented_4' || duty.crewComposition === 'augmented_3') {
    const hasIFR = duty.inflightRestBlocks && duty.inflightRestBlocks.length > 0;
    mitigations.push({
      priority: priority++,
      category: 'CREW_REST',
      title: 'Optimize In-Flight Rest Timing',
      text: hasIFR
        ? `Review the selected in-flight rest plan against the actual facility, crew allocation and approved operating procedures. ` +
          `Body-clock timing can influence sleep, but allocated rest is not necessarily sleep obtained. ` +
          `Allow for sleep inertia and follow the approved return-to-duty procedure before critical tasks.`
        : `Confirm whether a usable rest opportunity and approved allocation are available for this augmented crew. Coordinate with the crew and ` +
          `review the model’s sleep assumptions before relying on the prediction.`,
      reference: 'Signal et al., 2013; Gander et al., 2013',
      sourceKeys: ['signal_2013', 'gander_2013'],
    });
  }

  // 5. Landing performance risk
  if (
    duty.landingPerformance != null &&
    isElevatedRisk(classifyPerformance(duty.landingPerformance, thresholds))
  ) {
    const landingKss = resolveKss(duty.landingKss, duty.landingPerformance)!;
    mitigations.push({
      priority: priority++,
      category: 'MONITORING',
      title: 'Enhanced Crew Monitoring During Approach',
      text: `Predicted sleepiness at landing is ${formatKssWithLabel(landingKss)} (${classifyPerformance(duty.landingPerformance, thresholds)} band). ` +
        `Enhanced crew cross-checking is recommended during approach and landing. The Pilot Monitoring should ` +
        `maintain heightened vigilance for deviations from standard operating parameters. Any change of roles ` +
        `must follow the operator’s approved procedures; communicate fatigue concerns promptly.`,
      reference: 'ICAO Doc 9966 (FRMS Manual), 2016',
      sourceKeys: ['icao_9966'],
    });
  }

  // 6. Caffeine timing
  if (classifyPerformance(worstPerf, thresholds) !== 'low' && duty.woclExposure != null && duty.woclExposure > 0) {
    mitigations.push({
      priority: priority++,
      category: 'CAFFEINE',
      title: 'Strategic Caffeine Use',
      text: `Caffeine can temporarily improve alertness in some circumstances. Consider your usual response, ` +
        `applicable aeromedical advice and the timing of your next planned sleep. It can also interfere with ` +
        `recovery sleep. Aerowake does not model a caffeine dose or predict an individual KSS benefit. Protect ` +
        `recovery sleep quality.`,
      reference: 'Ker et al., 2010; Kamimori et al., 2015',
      sourceKeys: ['ker_2010', 'kamimori_2015'],
    });
  }

  // 7. Extended time awake
  if (duty.preDutyAwakeHours != null && duty.preDutyAwakeHours + duty.dutyHours > 17) {
    const totalAwake = duty.preDutyAwakeHours + duty.dutyHours;
    mitigations.push({
      priority: priority++,
      category: 'SCHEDULING',
      title: 'Time-Awake Risk Management',
      text: `Without intervening sleep, the schedule spans approximately ${totalAwake.toFixed(1)} hours from the estimated pre-duty wake time to release. Check actual sleep and in-flight rest before treating this as continuous wakefulness. ` +
        `Sleep pressure keeps building with continuous wakefulness, and long periods awake that end in the ` +
        `circadian low are a recognised fatigue hazard. For future rostering, review duty timing ` +
        `and feasible rest opportunities to limit continuous wakefulness during critical phases.`,
      reference: 'Ingre et al., 2014; Åkerstedt et al., 2014',
      sourceKeys: ['akerstedt_2014', 'akerstedt_sleepiness_2014'],
    });
  }

  // 8. FRMS documentation recommendation for high/critical risk
  if (duty.riskAdvisory === 'report_recommended') {
    mitigations.push({
      priority: priority++,
      category: 'GENERAL',
      title: 'FRMS Documentation Recommended',
      text: `This duty pattern reaches a predicted ${formatKssWithLabel(worstKss)}, indicating ` +
        `a substantive fatigue risk. Consider documenting this duty through your operator's Fatigue Risk ` +
        `Management System (FRMS) and reviewing whether systemic scheduling changes could reduce recurrence ` +
        `of this risk pattern.`,
      reference: 'ICAO Doc 9966; EASA AMC1 ORO.FTL.120',
      sourceKeys: ['icao_9966', 'easa_amc1_105'],
    });
  } else if (duty.riskAdvisory === 'consider_reporting') {
    mitigations.push({
      priority: priority++,
      category: 'GENERAL',
      title: 'Fatigue Risk Awareness',
      text: `This duty pattern reaches a predicted ${formatKssWithLabel(worstKss)}. This is a model reference, not an operational limit; review the assumptions and appropriate mitigations. If you experience ` +
        `symptoms of significant fatigue, consider documenting through your operator's FRMS.`,
      reference: 'ICAO Doc 9966',
      sourceKeys: ['icao_9966'],
    });
  }

  // Always include at least one mitigation
  if (mitigations.length === 0) {
    mitigations.push({
      priority: 1,
      category: 'GENERAL',
      title: 'Standard Fatigue Awareness',
      text: `Predicted sleepiness for this duty stays below the model watch band. Maintain standard fatigue ` +
        `awareness practices: monitor subjective sleepiness using the KSS or Samn-Perelli scale, ` +
        `communicate openly about fatigue within the crew, and prioritize recovery sleep after duty.`,
      reference: 'ICAO Doc 9966 (FRMS Manual), 2016',
      sourceKeys: ['icao_9966'],
    });
  }

  return mitigations.sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// Full Report Data Computation
// ---------------------------------------------------------------------------

/**
 * Compute all report data from a duty and its timeline.
 * This is the central function that feeds all report sections.
 */
export function computeReportData(
  duty: DutyAnalysis,
  timeline: TimelinePoint[],
): ReportData {
  const worstPoint = findWorstPoint(timeline);

  const decomposition = worstPoint
    ? decomposePerformance({
        performance: worstPoint.performance ?? 0,
        sleep_pressure: worstPoint.sleep_pressure,
        circadian: worstPoint.circadian,
        hours_on_duty: worstPoint.hours_on_duty,
        kss: worstPoint.kss,
        kss_90: worstPoint.kss_90,
        p_severe_sleepiness: worstPoint.p_severe_sleepiness,
        hours_awake: worstPoint.hours_awake,
      })
    : null;

  return {
    duty,
    timeline,
    worstPoint,
    decomposition,
    executiveSummary: generateExecutiveSummary(duty, worstPoint, decomposition),
    trajectoryNarrative: generateTrajectoryNarrative(duty, timeline),
    preDutyNarrative: generatePreDutyNarrative(duty),
    mitigations: generateMitigations(duty, timeline),
    criticalPhaseAnalysis: analyzeCriticalPhases(duty, timeline),
    thresholdCrossings: findThresholdCrossings(timeline, duty.riskThresholds),
  };
}
