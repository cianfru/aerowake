/**
 * Impairment equivalence utilities for the Fatigue Report Generator.
 *
 * Converts biomathematical model outputs (performance scores, sleep debt,
 * hours awake) into human-understandable impairment references that SMS
 * investigators and flight operations teams can interpret.
 *
 * All conversions cite their peer-reviewed sources.
 */

// ---------------------------------------------------------------------------
// BAC Equivalence — Dawson & Reid (1997)
// ---------------------------------------------------------------------------

/**
 * Convert hours of continuous wakefulness to approximate BAC equivalence.
 *
 * Based on Dawson & Reid (1997), Nature 388:235:
 *   • 17 hours awake ≈ 0.05% BAC
 *   • 24 hours awake ≈ 0.10% BAC
 *   • Relationship is approximately linear above 10h
 *
 * Note: This is a cognitive impairment EQUIVALENCE, not a claim that
 * fatigue and alcohol affect the brain through the same mechanisms.
 *
 * @param hoursAwake Continuous hours of wakefulness
 * @returns Approximate BAC equivalence (0.00–0.15+)
 */
export function hoursAwakeToBAC(hoursAwake: number): number {
  if (hoursAwake <= 10) return 0;
  // Linear interpolation: 17h → 0.05%, 24h → 0.10%
  return Math.max(0, (hoursAwake - 10) * (0.10 / 14));
}

/**
 * Format BAC as a human-readable string with context.
 */
export function formatBAC(bac: number): string {
  if (bac <= 0) return 'No measurable impairment equivalence';
  if (bac < 0.02) return `~${(bac * 100).toFixed(2)}% BAC (sub-threshold)`;
  if (bac < 0.05) return `~${(bac * 100).toFixed(2)}% BAC (mild impairment range)`;
  if (bac < 0.08) return `~${(bac * 100).toFixed(2)}% BAC (moderate impairment range)`;
  return `~${(bac * 100).toFixed(2)}% BAC (above legal driving limit in most jurisdictions)`;
}

// ---------------------------------------------------------------------------
// Performance → Equivalent Awake Hours (inverse Borbely mapping)
// ---------------------------------------------------------------------------

/**
 * Map model performance score to equivalent hours of continuous wakefulness.
 *
 * Uses piecewise linear interpolation calibrated against the Borbely
 * Two-Process Model homeostatic decay curve with typical circadian drive.
 *
 *   P = 100 → ~0h (fully rested)
 *   P = 95  → ~8h (normal waking)
 *   P = 88  → ~12h
 *   P = 77  → ~14h (threshold of cognitive fatigue)
 *   P = 70  → ~16h
 *   P = 55  → ~19h (significant impairment)
 *   P = 35  → ~22h (severe impairment)
 *   P = 20  → ~26h+ (extreme impairment)
 */
export function performanceToEquivalentAwakeHours(performance: number): number {
  const p = Math.max(20, Math.min(100, performance));
  const breakpoints: [number, number][] = [
    [100, 0],
    [95, 8],
    [88, 12],
    [77, 14],
    [70, 16],
    [55, 19],
    [35, 22],
    [20, 26],
  ];

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [p1, h1] = breakpoints[i];
    const [p2, h2] = breakpoints[i + 1];
    if (p >= p2 && p <= p1) {
      const ratio = (p1 - p) / (p1 - p2);
      return h1 + ratio * (h2 - h1);
    }
  }

  return p >= 100 ? 0 : 26;
}

/**
 * Describe the impairment level for a given number of hours awake.
 *
 * Based on Dawson & Reid (1997) cognitive performance decay curves
 * and Lamond & Dawson (1999) supplementary data.
 */
export function describeAwakeHoursImpairment(hours: number): {
  severity: 'none' | 'mild' | 'moderate' | 'significant' | 'severe';
  label: string;
  description: string;
} {
  if (hours <= 12) {
    return {
      severity: 'none',
      label: 'Normal waking period',
      description: 'Cognitive performance within normal range. No measurable impairment.',
    };
  }
  if (hours <= 15) {
    return {
      severity: 'mild',
      label: 'Extended wakefulness',
      description: 'Onset of mild cognitive impairment. Attention and vigilance begin to degrade, particularly for monotonous tasks.',
    };
  }
  if (hours <= 17) {
    return {
      severity: 'moderate',
      label: 'Moderate impairment',
      description: `Cognitive performance equivalent to approximately ${(hoursAwakeToBAC(hours) * 100).toFixed(2)}% BAC. Reaction time, decision-making, and situational awareness are measurably degraded.`,
    };
  }
  if (hours <= 20) {
    return {
      severity: 'significant',
      label: 'Significant impairment',
      description: `Cognitive performance equivalent to ${(hoursAwakeToBAC(hours) * 100).toFixed(2)}% BAC. Risk of attention lapses significantly elevated. Performance on complex tasks substantially degraded.`,
    };
  }
  return {
    severity: 'severe',
    label: 'Severe impairment',
    description: `Cognitive performance equivalent to ${(hoursAwakeToBAC(hours) * 100).toFixed(2)}% BAC, exceeding the legal driving limit in most jurisdictions. High risk of microsleeps and gross performance errors.`,
  };
}

// ---------------------------------------------------------------------------
// Sleep Debt Severity — Van Dongen et al. (2003)
// ---------------------------------------------------------------------------

/**
 * Classify cumulative sleep debt severity.
 *
 * Based on Van Dongen et al. (2003), Sleep 26(2):117-126:
 * "The Cumulative Cost of Additional Wakefulness"
 *
 * Chronic sleep restriction to 6h/night for 14 days produces cognitive
 * impairment equivalent to 1-2 nights of total sleep deprivation.
 *
 * @param debtHours Cumulative sleep debt in hours
 */
export function sleepDebtSeverity(debtHours: number): {
  severity: 'minimal' | 'moderate' | 'significant' | 'severe';
  label: string;
  description: string;
  reference: string;
} {
  if (debtHours <= 2) {
    return {
      severity: 'minimal',
      label: 'Minimal sleep debt',
      description: 'Sleep debt within normal variation. No significant impact on baseline cognitive performance.',
      reference: 'Van Dongen et al., 2003',
    };
  }
  if (debtHours <= 4) {
    return {
      severity: 'moderate',
      label: 'Moderate sleep debt',
      description: `Cumulative deficit of ${debtHours.toFixed(1)}h increases vulnerability to attention lapses by approximately 15-25%. The pilot may not subjectively perceive this impairment (Van Dongen et al., 2003).`,
      reference: 'Van Dongen et al., 2003',
    };
  }
  if (debtHours <= 6) {
    return {
      severity: 'significant',
      label: 'Significant sleep debt',
      description: `Cumulative deficit of ${debtHours.toFixed(1)}h substantially increases vulnerability to performance errors. Attention lapses may increase by 40-60%. Subjective sleepiness ratings often plateau, masking true impairment.`,
      reference: 'Van Dongen et al., 2003; Belenky et al., 2003',
    };
  }
  return {
    severity: 'severe',
    label: 'Severe sleep debt',
    description: `Cumulative deficit of ${debtHours.toFixed(1)}h represents severe chronic sleep restriction. Cognitive performance approaches levels seen after 24-48h of total sleep deprivation. Recovery requires 2-3 nights of unrestricted sleep (Kitamura et al., 2016).`,
    reference: 'Van Dongen et al., 2003; Kitamura et al., 2016',
  };
}

// ---------------------------------------------------------------------------
// Prior Sleep Assessment
// ---------------------------------------------------------------------------

const RECOMMENDED_SLEEP_HOURS = 8.0;

/**
 * Assess the adequacy of prior sleep before a duty period.
 */
export function assessPriorSleep(priorSleepHours: number): {
  adequacy: 'adequate' | 'marginal' | 'insufficient' | 'severely_insufficient';
  label: string;
  description: string;
} {
  const deficit = RECOMMENDED_SLEEP_HOURS - priorSleepHours;

  if (priorSleepHours >= 7.5) {
    return {
      adequacy: 'adequate',
      label: 'Adequate',
      description: `${priorSleepHours.toFixed(1)}h obtained (recommended: ${RECOMMENDED_SLEEP_HOURS}h). Sleep opportunity was sufficient to maintain baseline cognitive performance.`,
    };
  }
  if (priorSleepHours >= 6) {
    return {
      adequacy: 'marginal',
      label: 'Marginal',
      description: `${priorSleepHours.toFixed(1)}h obtained, creating a ${deficit.toFixed(1)}h acute deficit from the recommended ${RECOMMENDED_SLEEP_HOURS}h. Mild degradation in sustained attention expected during later duty hours.`,
    };
  }
  if (priorSleepHours >= 4.5) {
    return {
      adequacy: 'insufficient',
      label: 'Insufficient',
      description: `${priorSleepHours.toFixed(1)}h obtained, creating a ${deficit.toFixed(1)}h acute deficit. This level of restriction significantly increases vulnerability to performance errors, particularly during circadian low periods (Belenky et al., 2003).`,
    };
  }
  return {
    adequacy: 'severely_insufficient',
    label: 'Severely Insufficient',
    description: `Only ${priorSleepHours.toFixed(1)}h obtained (${deficit.toFixed(1)}h deficit). This approximates partial sleep deprivation. High risk of attention lapses, microsleeps, and impaired decision-making throughout the duty period.`,
  };
}

// ---------------------------------------------------------------------------
// WOCL Exposure Assessment
// ---------------------------------------------------------------------------

/**
 * Assess Window of Circadian Low exposure during a duty.
 *
 * WOCL is defined as 02:00–05:59 home base time per AMC1 ORO.FTL.105(10).
 * Exposure to WOCL during duty significantly reduces circadian alertness.
 */
export function assessWOCLExposure(woclHours: number): {
  severity: 'none' | 'partial' | 'significant' | 'full';
  label: string;
  description: string;
} {
  if (woclHours <= 0) {
    return {
      severity: 'none',
      label: 'No WOCL exposure',
      description: 'Duty does not encroach on the Window of Circadian Low (02:00–05:59 home base time). Circadian drive supports alertness throughout.',
    };
  }
  if (woclHours <= 1.5) {
    return {
      severity: 'partial',
      label: 'Partial WOCL exposure',
      description: `${woclHours.toFixed(1)}h of duty falls within the WOCL (02:00–05:59). Circadian alertness will dip during this window, with a nadir typically around 04:00–05:00 body clock time.`,
    };
  }
  if (woclHours <= 3) {
    return {
      severity: 'significant',
      label: 'Significant WOCL exposure',
      description: `${woclHours.toFixed(1)}h of duty falls within the WOCL. The pilot traverses the circadian nadir, where alertness can drop to 50-60% of daytime levels (Åkerstedt & Folkard, 1997). Critical tasks during this window carry elevated risk.`,
    };
  }
  return {
    severity: 'full',
    label: 'Full WOCL exposure',
    description: `${woclHours.toFixed(1)}h of duty within the WOCL — the duty spans nearly the entire circadian low window. This is a high-risk pattern. Human circadian physiology strongly opposes sustained alertness during this period.`,
  };
}

// ---------------------------------------------------------------------------
// Time Awake at Critical Phase
// ---------------------------------------------------------------------------

/**
 * Describe time-awake impairment at a specific duty phase.
 */
export function describeTimeAwakeAtPhase(
  preDutyAwakeHours: number,
  hoursOnDuty: number,
  phaseName: string,
): string {
  const totalAwake = preDutyAwakeHours + hoursOnDuty;
  const bac = hoursAwakeToBAC(totalAwake);
  const impairment = describeAwakeHoursImpairment(totalAwake);

  let text = `At the time of ${phaseName}, the pilot had been continuously awake for approximately ${totalAwake.toFixed(1)} hours`;
  text += ` (${preDutyAwakeHours.toFixed(1)}h pre-duty + ${hoursOnDuty.toFixed(1)}h on duty).`;

  if (bac > 0.01) {
    text += ` This level of wakefulness is associated with cognitive impairment equivalent to approximately ${(bac * 100).toFixed(2)}% BAC (Dawson & Reid, 1997).`;
  }

  return text;
}

// ---------------------------------------------------------------------------
// Risk Level Descriptions
// ---------------------------------------------------------------------------

/**
 * Provide a detailed description for each risk level.
 */
export function describeRiskLevel(risk: string): {
  label: string;
  description: string;
  implication: string;
} {
  switch (risk.toUpperCase()) {
    case 'LOW':
      return {
        label: 'Low Risk',
        description: 'Predicted performance remains above 72% throughout the duty period.',
        implication: 'Fatigue is not expected to be a significant factor. Standard operating procedures are sufficient.',
      };
    case 'MODERATE':
      return {
        label: 'Moderate Risk',
        description: 'Predicted performance dips below 72% during some phases, indicating onset of cognitive fatigue.',
        implication: 'Self-monitoring recommended. Be mindful of fatigue symptoms, especially during critical flight phases.',
      };
    case 'HIGH':
      return {
        label: 'High Risk',
        description: 'Predicted performance drops below 60% at some point during the duty, indicating elevated cognitive fatigue.',
        implication: 'Active fatigue countermeasures recommended. Consider strategic caffeine use and controlled rest if operationally feasible.',
      };
    case 'CRITICAL':
      return {
        label: 'Critical Risk',
        description: 'Predicted performance drops below 50%, indicating significant cognitive impairment.',
        implication: 'This duty pattern presents a substantive fatigue risk. Consider documenting through your FRMS and reviewing whether scheduling changes could reduce this risk pattern.',
      };
    default:
      return {
        label: risk,
        description: 'Risk level assessed based on biomathematical fatigue modeling.',
        implication: 'Review duty details for specific risk factors.',
      };
  }
}
