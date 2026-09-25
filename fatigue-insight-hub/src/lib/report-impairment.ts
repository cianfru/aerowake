/**
 * Contextual descriptions for the Fatigue Report Generator (sleep, WOCL,
 * time awake, risk bands).
 *
 * Retired: BAC ("alcohol-equivalent") conversions and the mapping from the
 * score to "equivalent hours awake". The 20–100 index is a linear
 * re-expression of predicted KSS (aerowake-4.0-kss); it is not
 * alcohol-equivalent and has no validated mapping to hours of wakefulness.
 * Time awake is reported directly from the model instead.
 */

import { RISK_LEVEL_KSS_RANGE, normalizeRiskLevel } from '@/lib/risk-scale';

// ---------------------------------------------------------------------------
// Hours awake (reported directly, no alcohol equivalence)
// ---------------------------------------------------------------------------

/**
 * Describe a period of continuous wakefulness in plain language.
 * Qualitative only; the KSS prediction already accounts for time awake.
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
      description: 'Extended wakefulness. Sleep pressure is high and sustained attention typically degrades, especially at night.',
    };
  }
  if (hours <= 20) {
    return {
      severity: 'significant',
      label: 'Significant impairment',
      description: 'Prolonged wakefulness. Attention lapses become considerably more likely, particularly during the circadian low.',
    };
  }
  return {
    severity: 'severe',
    label: 'Severe impairment',
    description: 'Very prolonged wakefulness (beyond ~20 h). High likelihood of attention lapses and involuntary sleep episodes.',
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
  return {
    severity: debtHours <= 2 ? 'minimal' : debtHours <= 4 ? 'moderate' : debtHours <= 6 ? 'significant' : 'severe',
    label: 'Estimated sleep deficit',
    description: `${debtHours.toFixed(1)}h in the model's sleep ledger. This is an estimate based on sleep assumptions; it does not establish an equivalent period of total sleep deprivation or an individual impairment level.`,
    reference: 'Model estimate; individual validation pending',
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
      description: `${woclHours.toFixed(1)}h of duty falls within the WOCL. The pilot traverses the circadian nadir, where predicted sleepiness is highest for a given amount of prior sleep. Critical tasks during this window carry elevated risk.`,
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
  const impairment = describeAwakeHoursImpairment(totalAwake);

  let text = `At the time of ${phaseName}, the pilot had been continuously awake for approximately ${totalAwake.toFixed(1)} hours`;
  text += ` (${preDutyAwakeHours.toFixed(1)}h pre-duty + ${hoursOnDuty.toFixed(1)}h on duty).`;
  if (impairment.severity !== 'none') text += ` ${impairment.description}`;

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
  const level = normalizeRiskLevel(risk);
  const range = RISK_LEVEL_KSS_RANGE[level];
  switch (level) {
    case 'low':
      return {
        label: 'Low Risk',
        description: `Predicted sleepiness stays in the alert range (${range}; "alert" to "neither alert nor sleepy").`,
        implication: 'Fatigue is not expected to be a significant factor. Standard operating procedures are sufficient.',
      };
    case 'moderate':
      return {
        label: 'Moderate Risk',
        description: `Predicted sleepiness reaches ${range} ("some signs of sleepiness").`,
        implication: 'Self-monitoring recommended. Be mindful of fatigue symptoms, especially during critical flight phases.',
      };
    case 'high':
      return {
        label: 'High Risk',
        description: `Predicted sleepiness reaches ${range} ("sleepy, no effort to stay awake"). KSS ≥ 7 is associated with physiological signs of sleepiness.`,
        implication: 'Active fatigue countermeasures recommended. Consider strategic caffeine use and controlled rest if operationally feasible.',
      };
    case 'critical':
      return {
        label: 'Critical Risk',
        description: `Predicted sleepiness reaches ${range} ("sleepy, some effort to stay awake").`,
        implication: 'This duty pattern presents a substantive fatigue risk. Consider documenting through your FRMS and reviewing whether scheduling changes could reduce this risk pattern.',
      };
    case 'extreme':
      return {
        label: 'Extreme Risk',
        description: `Predicted sleepiness reaches ${range} ("very sleepy, fighting sleep").`,
        implication: 'Severe predicted sleepiness. Report through your FRMS; the pattern should be reviewed before it is flown again.',
      };
    default:
      return {
        label: risk,
        description: 'Risk level assessed from the predicted KSS (Three Process Model).',
        implication: 'Review duty details for specific risk factors.',
      };
  }
}
