// src/data/references.ts
// Shared scientific reference data for the Learn tab.
// Single source of truth — imported by ResearchReferencesPage, MathematicalModelPage, FatigueSciencePage.

export type ReferenceCategory =
  | 'model'
  | 'sleep'
  | 'circadian'
  | 'aviation'
  | 'regulation'
  | 'cabin_environment'
  | 'methodology';

export interface Reference {
  key: string;
  short: string;
  full: string;
  category: ReferenceCategory;
}

export const ALL_REFERENCES: Reference[] = [
  // ══════════════════════════════════════════════════════════════
  // FATIGUE MODELLING
  // ══════════════════════════════════════════════════════════════
  {
    key: 'borbely_1982',
    short: 'Borbély (1982)',
    full: 'Borbély AA. A two process model of sleep regulation. Hum Neurobiol 1:195-204',
    category: 'model',
  },
  {
    key: 'borbely_achermann_1999',
    short: 'Borbély & Achermann (1999)',
    full: 'Borbély AA, Achermann P. Sleep homeostasis and models of sleep regulation. J Biol Rhythms 14(6):557-568. Also: Pharmacopsychiatry 32:56-67 (SWA power decline during sleep)',
    category: 'model',
  },
  {
    key: 'folkard_1999',
    short: 'Folkard & Åkerstedt (1999)',
    full: 'Folkard S, Åkerstedt T. Beyond the three-process model of alertness. J Biol Rhythms 14(6):577-587',
    category: 'model',
  },
  {
    key: 'jewett_kronauer_1999',
    short: 'Jewett & Kronauer (1999)',
    full: 'Jewett ME, Kronauer RE. Interactive mathematical models of subjective alertness and cognitive throughput in humans. J Biol Rhythms 14(6):588-597. Time constants: τᵢ = 18.2h (wake buildup), τ_d = 4.2h (sleep decay)',
    category: 'model',
  },
  {
    key: 'akerstedt_2014',
    short: 'Åkerstedt et al. (2014)',
    full: 'Åkerstedt T et al. Predicting sleepiness in airline operations using the BAM three-process model. PLOS ONE 9(10):e108769',
    category: 'model',
  },
  {
    key: 'belenky_2003',
    short: 'Belenky et al. (2003)',
    full: 'Belenky G et al. Patterns of performance degradation and restoration during sleep restriction and subsequent recovery. J Sleep Res 12:1-12',
    category: 'model',
  },
  {
    key: 'van_dongen_2003',
    short: 'Van Dongen et al. (2003)',
    full: 'Van Dongen HPA et al. The cumulative cost of additional wakefulness: dose-response effects on neurobehavioral functions and sleep physiology. Sleep 26(2):117-126',
    category: 'model',
  },
  {
    key: 'van_dongen_2004',
    short: 'Van Dongen et al. (2004)',
    full: 'Van Dongen HPA et al. Systematic interindividual differences in neurobehavioral impairment from sleep loss: evidence of trait-like differential vulnerability. Sleep 27(3):423-433',
    category: 'model',
  },
  {
    key: 'banks_dinges_2007',
    short: 'Banks & Dinges (2007)',
    full: 'Banks S, Dinges DF. Behavioral and physiological consequences of sleep restriction. J Clin Sleep Med 3(5):519-528. Also: Prog Brain Res 185:41-53',
    category: 'model',
  },
  {
    key: 'mccauley_2013',
    short: 'McCauley et al. (2013)',
    full: 'McCauley P et al. A new mathematical model for the homeostatic effects of sleep loss on neurobehavioral performance. Proc Natl Acad Sci 110:E2380-E2389. Chronic sleep restriction dampens circadian amplitude.',
    category: 'model',
  },
  {
    key: 'roenneberg_2007',
    short: 'Roenneberg et al. (2007)',
    full: 'Roenneberg T et al. Epidemiology of the human circadian clock. Sleep Med Rev 11(6):429-438. Also: Curr Biol 17:R44-R45. Chronotype shifts acrophase ±2h.',
    category: 'model',
  },
  {
    key: 'dawson_reid_1997',
    short: 'Dawson & Reid (1997)',
    full: 'Dawson D, Reid K. Fatigue, alcohol and performance impairment. Nature 388:235. 17h awake ≈ 0.05% BAC.',
    category: 'model',
  },
  {
    key: 'hursh_2004',
    short: 'Hursh et al. (2004)',
    full: 'Hursh SR et al. Fatigue models for applied research in warfighting. Aviat Space Environ Med 75(3 Suppl):A44-53',
    category: 'model',
  },

  // ══════════════════════════════════════════════════════════════
  // CIRCADIAN RHYTHM
  // ══════════════════════════════════════════════════════════════
  {
    key: 'dijk_czeisler_1995',
    short: 'Dijk & Czeisler (1995)',
    full: 'Dijk D-J, Czeisler CA. Contribution of the circadian pacemaker and the sleep homeostat to sleep propensity, sleep structure and EEG. J Neurosci 15:3526-3538',
    category: 'circadian',
  },
  {
    key: 'dijk_czeisler_1994',
    short: 'Dijk & Czeisler (1994)',
    full: 'Dijk D-J, Czeisler CA. Paradoxical timing of the circadian rhythm of sleep propensity serves to consolidate sleep and wakefulness. J Sleep Res 3:73-82. Describes the Wake Maintenance Zone (WMZ) second harmonic.',
    category: 'circadian',
  },
  {
    key: 'lavie_1986',
    short: 'Lavie (1986)',
    full: 'Lavie P. Ultrashort sleep-waking schedule. III. "Gates" and "forbidden zones" for sleep. Electroencephalogr Clin Neurophysiol 63:414-425. Also: Sleep 9:355-366.',
    category: 'circadian',
  },
  {
    key: 'strogatz_1987',
    short: 'Strogatz et al. (1987)',
    full: 'Strogatz SH et al. Circadian pacemaker interferes with sleep onset at specific times each day: role in insomnia. Am J Physiol 253:R173-R178. Confirmed bimodal sleep propensity structure.',
    category: 'circadian',
  },
  {
    key: 'minors_1981',
    short: 'Minors & Waterhouse (1981)',
    full: 'Minors DS, Waterhouse JM. Anchor sleep as a synchronizer of rhythms on abnormal routines. Int J Chronobiol 8:165-88',
    category: 'circadian',
  },
  {
    key: 'minors_1983',
    short: 'Minors & Waterhouse (1983)',
    full: 'Minors DS, Waterhouse JM. Does anchor sleep entrain circadian rhythms? J Physiol 345:1-11',
    category: 'circadian',
  },
  {
    key: 'waterhouse_2007',
    short: 'Waterhouse et al. (2007)',
    full: 'Waterhouse J et al. Jet lag: trends and coping strategies. Aviat Space Environ Med 78(5):B1-B10. Adaptation rates: westward 1.5 h/day, eastward 1.0 h/day.',
    category: 'circadian',
  },

  // ══════════════════════════════════════════════════════════════
  // SLEEP SCIENCE
  // ══════════════════════════════════════════════════════════════
  {
    key: 'banks_2010',
    short: 'Banks et al. (2010)',
    full: 'Banks S et al. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep 33(8):1013-1026. Recovery sleep averaged 9.0h after 5 nights of 4h TIB.',
    category: 'sleep',
  },
  {
    key: 'kitamura_2016',
    short: 'Kitamura et al. (2016)',
    full: 'Kitamura S et al. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep 6:35812. 1h debt needs ~4 days for 75% recovery.',
    category: 'sleep',
  },
  {
    key: 'dinges_1987',
    short: 'Dinges et al. (1987)',
    full: 'Dinges DF et al. Temporal placement of a nap for alertness: contributions of circadian phase and prior wakefulness. Sleep 10(4):313-329',
    category: 'sleep',
  },
  {
    key: 'jackson_2014',
    short: 'Jackson et al. (2014)',
    full: 'Jackson ML et al. Investigation of the effectiveness of a split sleep schedule in sustaining performance. Accid Anal Prev 72:252-261. Split sleep (4+4h) ≈ 92% of consolidated 8h.',
    category: 'sleep',
  },
  {
    key: 'kosmadopoulos_2017',
    short: 'Kosmadopoulos et al. (2017)',
    full: 'Kosmadopoulos A et al. The effects of a split sleep-wake schedule on neurobehavioural performance. Chronobiol Int 34(2):190-196',
    category: 'sleep',
  },
  {
    key: 'tassi_muzet_2000',
    short: 'Tassi & Muzet (2000)',
    full: 'Tassi P, Muzet A. Sleep inertia. Sleep Med Rev 4(4):341-353. Typical duration ~30 min, max magnitude ~30% performance reduction.',
    category: 'sleep',
  },
  {
    key: 'brooks_lack_2006',
    short: 'Brooks & Lack (2006)',
    full: 'Brooks A, Lack LC. A brief afternoon nap following nocturnal sleep restriction: which nap duration is most recuperative? Sleep 29(6):831-840. 10-min nap optimal for alertness; 30+ min naps risk sleep inertia.',
    category: 'sleep',
  },
  {
    key: 'tietzel_lack_2002',
    short: 'Tietzel & Lack (2002)',
    full: 'Tietzel AJ, Lack LC. The recuperative value of brief and ultra-brief naps on alertness and cognitive performance. J Sleep Res 11(3):213-218. Brief naps (<20 min) improve alertness without SWS inertia.',
    category: 'sleep',
  },
  {
    key: 'agnew_1966',
    short: 'Agnew et al. (1966)',
    full: 'Agnew HW Jr, Webb WB, Williams RL. The first night effect: an EEG study of sleep. Psychophysiology 2(3):263-266. Increased SOL, reduced SWS%, more WASO on first night in novel environment.',
    category: 'sleep',
  },
  {
    key: 'tamaki_2016',
    short: 'Tamaki et al. (2016)',
    full: 'Tamaki M et al. Night watch in one brain hemisphere during sleep associated with the first-night effect in humans. Curr Biol 26(9):1190-1194. Unihemispheric slow-wave activity on first night.',
    category: 'sleep',
  },
  {
    key: 'akerstedt_2008',
    short: 'Åkerstedt et al. (2008)',
    full: 'Åkerstedt T et al. Sleep duration, mortality and markers of regional brain activity. J Sleep Res 17:295-304. SOL varies with circadian phase and homeostatic pressure.',
    category: 'sleep',
  },
  {
    key: 'kecklund_akerstedt_2004',
    short: 'Kecklund & Åkerstedt (2004)',
    full: 'Kecklund G, Åkerstedt T. Apprehension of the subsequent working day is associated with a low amount of sleep. Biol Psychol 66(2):169-176. Early report (<06:00) → −3% sleep quality via alarm anxiety.',
    category: 'sleep',
  },
  {
    key: 'akerstedt_2003',
    short: 'Åkerstedt (2003)',
    full: 'Åkerstedt T. Shift work and disturbed sleep/wakefulness. Occup Med 53:89-94. Shift-work sleep disruption baseline.',
    category: 'sleep',
  },
  {
    key: 'national_academies_2011',
    short: 'National Academies (2011)',
    full: 'National Research Council. The Effects of Commuting on Pilot Fatigue. Washington, DC: The National Academies Press. Ch.5: Sleep Regulation and Circadian Rhythms',
    category: 'sleep',
  },

  // ══════════════════════════════════════════════════════════════
  // AVIATION FATIGUE
  // ══════════════════════════════════════════════════════════════
  {
    key: 'signal_2009',
    short: 'Signal et al. (2009)',
    full: 'Signal TL et al. Flight crew fatigue during multi-sector operations. J Sleep Res 18:245-253',
    category: 'aviation',
  },
  {
    key: 'signal_2013',
    short: 'Signal et al. (2013)',
    full: 'Signal TL et al. Sleep duration and quality in healthy volunteers: subjectively and objectively measured. Sleep 36(1):109-118. PSG measured hotel sleep efficiency 88%, inflight crew rest 70%.',
    category: 'aviation',
  },
  {
    key: 'signal_2014',
    short: 'Signal et al. (2014)',
    full: 'Signal TL et al. Mitigating and monitoring flight crew fatigue on ultra-long range flights. Aviat Space Environ Med 85:1199-1208',
    category: 'aviation',
  },
  {
    key: 'gander_2013',
    short: 'Gander et al. (2013)',
    full: 'Gander PH et al. In-flight sleep, pilot fatigue and PVT performance on ultra-long range vs. long range flights. J Sleep Res 22(6):697-706',
    category: 'aviation',
  },
  {
    key: 'gander_2014',
    short: 'Gander et al. (2014)',
    full: 'Gander PH et al. Pilot fatigue: relationships with departure/arrival times and flight segment durations. Aviat Space Environ Med 85(8):833-40',
    category: 'aviation',
  },
  {
    key: 'roach_2012',
    short: 'Roach et al. (2012)',
    full: 'Roach GD et al. Duty periods with early start times restrict the amount of sleep obtained by short-haul airline pilots. Accid Anal Prev 45 Suppl:22-26',
    category: 'aviation',
  },
  {
    key: 'rempe_2025',
    short: 'Rempe et al. (2025)',
    full: 'Rempe MJ et al. Layover start timing predicts layover sleep quantity in long-range airline pilots. SLEEP Advances 6(1):zpaf009. PMC11879054',
    category: 'aviation',
  },
  {
    key: 'arsintescu_2022',
    short: 'Arsintescu et al. (2022)',
    full: 'Arsintescu L et al. Early starts and late finishes in short-haul aviation: effects on sleep and alertness. J Sleep Res 31(3):e13521',
    category: 'aviation',
  },
  {
    key: 'bourgeois_2003',
    short: 'Bourgeois-Bougrine et al. (2003)',
    full: 'Bourgeois-Bougrine S et al. Perceived fatigue in airline pilots: measurement and analysis of contributing factors. Int J Aviat Psychol 13(3):249-267',
    category: 'aviation',
  },
  {
    key: 'fuentes_garcia_2021',
    short: 'Fuentes-Garcia et al. (2021)',
    full: 'Fuentes-Garcia JP et al. Physiological responses during flight simulation: heart rate and cortisol. Sci Rep 11:1-10. Simulator ~32% lower physiological stress vs real flight.',
    category: 'aviation',
  },
  {
    key: 'cabon_2008',
    short: 'Cabon et al. (2008)',
    full: 'Cabon P et al. Non-linear time-on-task model of cockpit crew fatigue. Int J Ind Ergon 38:885-891. Fatigue accelerates beyond ~8h duty.',
    category: 'aviation',
  },
  {
    key: 'cabon_1993',
    short: 'Cabon et al. (1993)',
    full: 'Cabon P et al. Workload and flight phase related parameters in aircraft cockpits. Applied ergonomics, flight workload factors.',
    category: 'aviation',
  },
  {
    key: 'gander_1994',
    short: 'Gander et al. (1994)',
    full: 'Gander PH et al. Flight crew fatigue V: duty period scheduling. Aviat Space Environ Med 65(5 Suppl):A56-A60. Workload variation by flight phase.',
    category: 'aviation',
  },
  {
    key: 'hamann_2023',
    short: 'Hamann & Carstengerdes (2023)',
    full: 'Hamann A, Carstengerdes N. Subjective fatigue increases linearly during simulator sessions: implications for FRMBS design. Aerosp Med Hum Perform.',
    category: 'aviation',
  },

  // ══════════════════════════════════════════════════════════════
  // CABIN ENVIRONMENT
  // ══════════════════════════════════════════════════════════════
  {
    key: 'nesthus_2007',
    short: 'Nesthus et al. (2007)',
    full: 'Nesthus TE et al. Effects of reduced oxygen and cabin altitude on cognitive performance in pilots. DOT/FAA/AM-07/21. Mild hypoxia at cabin altitude reduces cognitive performance 1-3%.',
    category: 'cabin_environment',
  },
  {
    key: 'muhm_2007',
    short: 'Muhm et al. (2007)',
    full: 'Muhm JM et al. Effect of aircraft-cabin altitude on passenger discomfort. Aviat Space Environ Med 78:B13-B18. Cabin altitudes 6,000-8,000 ft equivalent produce measurable SpO₂ reduction.',
    category: 'cabin_environment',
  },

  // ══════════════════════════════════════════════════════════════
  // METHODOLOGY (Measurement & Metrics)
  // ══════════════════════════════════════════════════════════════
  {
    key: 'basner_dinges_2011',
    short: 'Basner & Dinges (2011)',
    full: 'Basner M, Dinges DF. Maximizing sensitivity of the Psychomotor Vigilance Test (PVT) to sleep loss. Sleep 34(5):581-591. PVT lapses dose-response formula.',
    category: 'methodology',
  },
  {
    key: 'akerstedt_2010',
    short: 'Åkerstedt et al. (2010)',
    full: 'Åkerstedt T et al. Microsleep episodes during driving: sleep propensity and circadian vulnerability. J Sleep Res 19:549-560. Microsleep probability formula.',
    category: 'methodology',
  },

  // ══════════════════════════════════════════════════════════════
  // REGULATORY
  // ══════════════════════════════════════════════════════════════
  {
    key: 'easa_oro_ftl',
    short: 'EASA ORO.FTL (2014)',
    full: 'Commission Regulation (EU) No 83/2014 (ORO.FTL Subpart FTL). Flight time limitations and rest requirements for commercial air transport crew members',
    category: 'regulation',
  },
  {
    key: 'easa_amc1_105',
    short: 'EASA AMC1 ORO.FTL.105',
    full: 'Acceptable Means of Compliance: Definitions including WOCL (02:00-05:59 home base time), acclimatization, and maximum FDP tables',
    category: 'regulation',
  },
];

// ── Category display configuration ──────────────────────────────

export const CATEGORY_CONFIG: Record<string, { label: string; color: string; iconName: string }> = {
  model:              { label: 'Fatigue Modelling',   color: 'text-primary',            iconName: 'Brain' },
  circadian:          { label: 'Circadian Rhythm',    color: 'text-warning',            iconName: 'FlaskConical' },
  sleep:              { label: 'Sleep Science',       color: 'text-chart-2',            iconName: 'Moon' },
  aviation:           { label: 'Aviation Fatigue',    color: 'text-success',            iconName: 'Plane' },
  cabin_environment:  { label: 'Cabin Environment',   color: 'text-chart-4',            iconName: 'Mountain' },
  methodology:        { label: 'Methodology',         color: 'text-muted-foreground',   iconName: 'BookOpen' },
  regulation:         { label: 'Regulatory',          color: 'text-high',               iconName: 'Shield' },
};

export const CATEGORY_ORDER = [
  'model',
  'circadian',
  'sleep',
  'aviation',
  'cabin_environment',
  'methodology',
  'regulation',
] as const;

// ── Helper ───────────────────────────────────────────────────────

export function getReferenceByKey(key: string): Reference | undefined {
  return ALL_REFERENCES.find(r => r.key === key);
}

/** Group references by category, sorted alphabetically within each group. */
export function groupByCategory(refs: Reference[]): Record<string, Reference[]> {
  const groups: Record<string, Reference[]> = {};
  for (const ref of refs) {
    if (!groups[ref.category]) groups[ref.category] = [];
    groups[ref.category].push(ref);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.short.localeCompare(b.short));
  }
  return groups;
}
