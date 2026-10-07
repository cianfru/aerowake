// Curated evidence catalogue. Bibliographic identification is not validation of
// Aerowake's derived assumptions. See docs/SCIENCE_SOURCE_AUDIT.md.

export type ReferenceCategory = 'model' | 'sleep' | 'circadian' | 'aviation' | 'regulation' | 'cabin_environment' | 'methodology';
export type SourceType = 'journal' | 'report' | 'regulation' | 'unresolved';
export interface Reference {
  key: string;
  short: string;
  full: string;
  category: ReferenceCategory;
  sourceType: SourceType;
  verification: 'identified' | 'unresolved';
  url?: string;
  doi?: string;
  application: string;
  relevance: string;
  limitation: string;
}

export const EVIDENCE_AUDIT_DATE = '7 October 2026';
export const ALL_REFERENCES: Reference[] = [
  {
    "key": "borbely_1982",
    "short": "Borbély (1982)",
    "full": "Borbély AA. A two process model of sleep regulation. Hum Neurobiol. 1982;1:195-204.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "url": "https://pubmed.ncbi.nlm.nih.gov/7185792/",
    "application": "Scientific foundation",
    "relevance": "Explains how sleep pressure and circadian timing contribute to sleep regulation.",
    "limitation": "Historical foundation; the current scoring equations come from Ingre et al. (2014)."
  },
  {
    "key": "borbely_achermann_1999",
    "short": "Borbély & Achermann (1999)",
    "full": "Borbély AA, Achermann P. Sleep homeostasis and models of sleep regulation. J Biol Rhythms. 1999;14:557-568.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1177/074873099129000894",
    "url": "https://doi.org/10.1177/074873099129000894",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "folkard_1999",
    "short": "Folkard & Åkerstedt (1999)",
    "full": "Folkard S, Akerstedt T, Macdonald I, Tucker P, Spencer MB. Beyond the three-process model of alertness: estimating phase, time on shift, and successive night effects. J Biol Rhythms. 1999;14:577-587.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1177/074873099129000911",
    "url": "https://doi.org/10.1177/074873099129000911",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "jewett_kronauer_1999",
    "short": "Jewett & Kronauer (1999)",
    "full": "Jewett ME, Kronauer RE. Interactive mathematical models of subjective alertness and cognitive throughput in humans. J Biol Rhythms. 1999;14:588-597.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1177/074873099129000920",
    "url": "https://doi.org/10.1177/074873099129000920",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "akerstedt_2014",
    "short": "Ingre et al. (2014)",
    "full": "Ingre M, Van Leeuwen W, Klemets T, Ullvetter C, Hough S, Kecklund G, Karlsson D, Åkerstedt T. Validating and extending the three process model of alertness in airline operations. PLoS One. 2014;9:e108679.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1371/journal.pone.0108679",
    "url": "https://doi.org/10.1371/journal.pone.0108679",
    "application": "Prediction core",
    "relevance": "The current KSS equations, group-average interpretation and body-clock adaptation are based on this airline-crew evaluation.",
    "limitation": "Its validation does not automatically validate Aerowake’s roster parser, inferred sleep, thresholds or complete forecast."
  },
  {
    "key": "belenky_2003",
    "short": "Belenky et al. (2003)",
    "full": "Belenky G, Wesensten NJ, Thorne DR, Thomas ML, Sing HC, Redmond DP, Russo MB, Balkin TJ. Patterns of performance degradation and restoration during sleep restriction and subsequent recovery: a sleep dose-response study. J Sleep Res. 2003;12:1-12.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1046/j.1365-2869.2003.00337.x",
    "url": "https://doi.org/10.1046/j.1365-2869.2003.00337.x",
    "application": "Sleep deficit",
    "relevance": "Supports reviewing cumulative sleep restriction and recovery across the roster.",
    "limitation": "Recovery varies; the application’s debt ledger is a separate modelling policy."
  },
  {
    "key": "van_dongen_2003",
    "short": "Van Dongen et al. (2003)",
    "full": "Van Dongen HP, Maislin G, Mullington JM, Dinges DF. The cumulative cost of additional wakefulness: dose-response effects on neurobehavioral functions and sleep physiology from chronic sleep restriction and total sleep deprivation. Sleep. 2003;26:117-126.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/26.2.117",
    "url": "https://doi.org/10.1093/sleep/26.2.117",
    "application": "Sleep deficit",
    "relevance": "Explains why repeated short sleep deserves attention even when subjective sleepiness levels off.",
    "limitation": "Laboratory performance outcomes do not establish a numerical Aerowake sleep-deficit penalty."
  },
  {
    "key": "van_dongen_2004",
    "short": "Van Dongen et al. (2004)",
    "full": "Van Dongen HP, Baynard MD, Maislin G, Dinges DF. Systematic interindividual differences in neurobehavioral impairment from sleep loss: evidence of trait-like differential vulnerability. Sleep. 2004;27:423-433.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/27.3.423",
    "url": "https://doi.org/10.1093/sleep/27.3.423",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "banks_dinges_2007",
    "short": "Banks & Dinges (2007)",
    "full": "Banks S, Dinges DF. Behavioral and physiological consequences of sleep restriction. J Clin Sleep Med. 2007;3:519-528.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.5664/jcsm.26918",
    "url": "https://doi.org/10.5664/jcsm.26918",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "mccauley_2013",
    "short": "McCauley et al. (2009)",
    "full": "McCauley P, Kalachev LV, Smith AD, Belenky G, Dinges DF, Van Dongen HP. A new mathematical model for the homeostatic effects of sleep loss on neurobehavioral performance. J Theor Biol. 2009;256:227-239.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.jtbi.2008.09.012",
    "url": "https://doi.org/10.1016/j.jtbi.2008.09.012",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "roenneberg_2007",
    "short": "Roenneberg et al. (2007)",
    "full": "Roenneberg T, Kuehnle T, Juda M, Kantermann T, Allebrandt K, Gordijn M, Merrow M. Epidemiology of the human circadian clock. Sleep Med Rev. 2007;11:429-438.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.smrv.2007.07.005",
    "url": "https://doi.org/10.1016/j.smrv.2007.07.005",
    "application": "Background research",
    "relevance": "Provides scientific context for fatigue modelling.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "dawson_reid_1997",
    "short": "Dawson & Reid (1997)",
    "full": "Dawson D, Reid K. Fatigue, alcohol and performance impairment. Nature. 1997;388:235.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1038/40775",
    "url": "https://doi.org/10.1038/40775",
    "application": "Background research",
    "relevance": "Demonstrates performance impairment during sustained wakefulness in an experiment.",
    "limitation": "Aerowake does not convert KSS into blood-alcohol equivalence."
  },
  {
    "key": "hursh_2004",
    "short": "Hursh et al. (2004)",
    "full": "Hursh SR, Redmond DP, Johnson ML, Thorne DR, Belenky G, Balkin TJ, Storm WF, Miller JC, Eddy DR. Fatigue models for applied research in warfighting. Aviat Space Environ Med. 2004;75:A44-53; discussion A54-60.",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "url": "https://pubmed.ncbi.nlm.nih.gov/15018265/",
    "application": "Model comparison",
    "relevance": "Describes fatigue models including the SAFTE modelling approach.",
    "limitation": "Aerowake is not SAFTE-FAST, and its KSS output is not interchangeable with effectiveness scores."
  },
  {
    "key": "dijk_czeisler_1995",
    "short": "Dijk & Czeisler (1995)",
    "full": "Dijk DJ, Czeisler CA. Contribution of the circadian pacemaker and the sleep homeostat to sleep propensity, sleep structure, electroencephalographic slow waves, and sleep spindle activity in humans. J Neurosci. 1995;15:3526-3538.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1523/jneurosci.15-05-03526.1995",
    "url": "https://doi.org/10.1523/jneurosci.15-05-03526.1995",
    "application": "Body-clock timing",
    "relevance": "Separates circadian and homeostatic contributions to sleep.",
    "limitation": "Experimental physiology does not measure an individual pilot’s current circadian phase."
  },
  {
    "key": "dijk_czeisler_1994",
    "short": "Dijk & Czeisler (1994)",
    "full": "Dijk DJ, Czeisler CA. Paradoxical timing of the circadian rhythm of sleep propensity serves to consolidate sleep and wakefulness in humans. Neurosci Lett. 1994;166:63-68.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/0304-3940(94)90841-9",
    "url": "https://doi.org/10.1016/0304-3940(94)90841-9",
    "application": "Sleep timing",
    "relevance": "Explains the evening wake-maintenance zone and why moving bedtime earlier may be difficult.",
    "limitation": "Does not establish the application’s exact nap cut-offs or sleep-quality factors."
  },
  {
    "key": "lavie_1986",
    "short": "Lavie (1986)",
    "full": "Lavie P. Ultrashort sleep-waking schedule. III. 'Gates' and 'forbidden zones' for sleep. Electroencephalogr Clin Neurophysiol. 1986;63:414-425.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/0013-4694(86)90123-9",
    "url": "https://doi.org/10.1016/0013-4694(86)90123-9",
    "application": "Background research",
    "relevance": "Provides scientific context for circadian timing.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "strogatz_1987",
    "short": "Strogatz et al. (1987)",
    "full": "Strogatz SH, Kronauer RE, Czeisler CA. Circadian pacemaker interferes with sleep onset at specific times each day: role in insomnia. Am J Physiol. 1987;253:R172-8.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1152/ajpregu.1987.253.1.r172",
    "url": "https://doi.org/10.1152/ajpregu.1987.253.1.r172",
    "application": "Background research",
    "relevance": "Provides scientific context for circadian timing.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "minors_1981",
    "short": "Minors & Waterhouse (1981)",
    "full": "Minors DS, Waterhouse JM. Anchor sleep as a synchronizer of rhythms on abnormal routines. Int J Chronobiol. 1981;7:165-188.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "url": "https://pubmed.ncbi.nlm.nih.gov/7239725/",
    "application": "Background research",
    "relevance": "Provides scientific context for circadian timing.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "minors_1983",
    "short": "Minors & Waterhouse (1983)",
    "full": "Minors DS, Waterhouse JM. Does 'anchor sleep' entrain circadian rhythms? Evidence from constant routine studies. J Physiol. 1983;345:451-467.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1113/jphysiol.1983.sp014988",
    "url": "https://doi.org/10.1113/jphysiol.1983.sp014988",
    "application": "Background research",
    "relevance": "Provides scientific context for circadian timing.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "waterhouse_2007",
    "short": "Waterhouse et al. (2007)",
    "full": "Waterhouse J, Reilly T, Atkinson G, Edwards B. Jet lag: trends and coping strategies. Lancet. 2007;369:1117-1129.",
    "category": "circadian",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/s0140-6736(07)60529-7",
    "url": "https://doi.org/10.1016/s0140-6736(07)60529-7",
    "application": "Background research",
    "relevance": "Provides scientific context for circadian timing.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "banks_2010",
    "short": "Banks et al. (2010)",
    "full": "Banks S, Van Dongen HP, Maislin G, Dinges DF. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep. 2010;33:1013-1026.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/33.8.1013",
    "url": "https://doi.org/10.1093/sleep/33.8.1013",
    "application": "Recovery sleep",
    "relevance": "Provides evidence on recovery after repeated sleep restriction.",
    "limitation": "Does not validate the application’s exact rebound-sleep or debt-repayment coefficients."
  },
  {
    "key": "kitamura_2016",
    "short": "Kitamura et al. (2016)",
    "full": "Kitamura S, Katayose Y, Nakazaki K, Motomura Y, Oba K, Katsunuma R, Terasawa Y, Enomoto M, Moriguchi Y, Hida A, Mishima K. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep. 2016;6:35812.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1038/srep35812",
    "url": "https://doi.org/10.1038/srep35812",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "dinges_1987",
    "short": "Dinges et al. (1987)",
    "full": "Dinges DF, Orne MT, Whitehouse WG, Orne EC. Temporal placement of a nap for alertness: contributions of circadian phase and prior wakefulness. Sleep. 1987;10:313-329.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/10.4.313",
    "url": "https://doi.org/10.1093/sleep/10.4.313",
    "application": "Nap timing",
    "relevance": "Examines how circadian phase and time awake influence a nap’s effect.",
    "limitation": "No fixed nap benefit or individual KSS reduction is implied."
  },
  {
    "key": "jackson_2014",
    "short": "Jackson et al. (2014)",
    "full": "Jackson ML, Banks S, Belenky G. Investigation of the effectiveness of a split sleep schedule in sustaining sleep and maintaining performance. Chronobiol Int. 2014;31:1218-1230.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3109/07420528.2014.957305",
    "url": "https://doi.org/10.3109/07420528.2014.957305",
    "application": "Split sleep",
    "relevance": "Examines sleep and performance under a split-sleep schedule.",
    "limitation": "The application’s exact split-sleep efficiency coefficients are not independently validated."
  },
  {
    "key": "kosmadopoulos_2017",
    "short": "Kosmadopoulos et al. (2014)",
    "full": "Kosmadopoulos A, Sargent C, Darwent D, Zhou X, Dawson D, Roach GD. The effects of a split sleep-wake schedule on neurobehavioural performance and predictions of performance under conditions of forced desynchrony. Chronobiol Int. 2014;31:1209-1217.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3109/07420528.2014.957763",
    "url": "https://doi.org/10.3109/07420528.2014.957763",
    "application": "Split sleep",
    "relevance": "Examines split sleep and neurobehavioural performance under forced desynchrony.",
    "limitation": "This is a 2014 article; the historical key is retained for saved citation links."
  },
  {
    "key": "tassi_muzet_2000",
    "short": "Tassi & Muzet (2000)",
    "full": "Tassi P, Muzet A. Sleep inertia. Sleep Med Rev. 2000;4:341-353.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1053/smrv.2000.0098",
    "url": "https://doi.org/10.1053/smrv.2000.0098",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "brooks_lack_2006",
    "short": "Brooks & Lack (2006)",
    "full": "Brooks A, Lack L. A brief afternoon nap following nocturnal sleep restriction: which nap duration is most recuperative? Sleep. 2006;29:831-840.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/29.6.831",
    "url": "https://doi.org/10.1093/sleep/29.6.831",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "tietzel_lack_2002",
    "short": "Tietzel & Lack (2002)",
    "full": "Tietzel AJ, Lack LC. The recuperative value of brief and ultra-brief naps on alertness and cognitive performance. J Sleep Res. 2002;11:213-218.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1046/j.1365-2869.2002.00299.x",
    "url": "https://doi.org/10.1046/j.1365-2869.2002.00299.x",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "agnew_1966",
    "short": "Agnew et al. (1966)",
    "full": "Agnew HW, Webb WB, Williams RL. The first night effect: an EEG study of sleep. Psychophysiology. 1966;2:263-266.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1111/j.1469-8986.1966.tb02650.x",
    "url": "https://doi.org/10.1111/j.1469-8986.1966.tb02650.x",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "tamaki_2016",
    "short": "Tamaki et al. (2016)",
    "full": "Tamaki M, Bang JW, Watanabe T, Sasaki Y. Night Watch in One Brain Hemisphere during Sleep Associated with the First-Night Effect in Humans. Curr Biol. 2016;26:1190-1194.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.cub.2016.02.063",
    "url": "https://doi.org/10.1016/j.cub.2016.02.063",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "akerstedt_2008",
    "short": "Åkerstedt et al. (2008)",
    "full": "Åkerstedt T et al. Sleep duration, mortality and markers of regional brain activity.",
    "category": "sleep",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "kecklund_akerstedt_2004",
    "short": "Kecklund & Åkerstedt (2004)",
    "full": "Kecklund G, Akerstedt T. Apprehension of the subsequent working day is associated with a low amount of slow wave sleep. Biol Psychol. 2004;66:169-176.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.biopsycho.2003.10.004",
    "url": "https://doi.org/10.1016/j.biopsycho.2003.10.004",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "akerstedt_2003",
    "short": "Åkerstedt (2003)",
    "full": "Akerstedt T. Shift work and disturbed sleep/wakefulness. Occup Med (Lond). 2003;53:89-94.",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/occmed/kqg046",
    "url": "https://doi.org/10.1093/occmed/kqg046",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "national_academies_2011",
    "short": "National Academies (2011)",
    "full": "National Research Council. The Effects of Commuting on Pilot Fatigue. Washington, DC: The National Academies Press; 2011.",
    "category": "sleep",
    "sourceType": "report",
    "verification": "identified",
    "doi": "10.17226/13201",
    "url": "https://doi.org/10.17226/13201",
    "application": "Background research",
    "relevance": "Provides scientific context for sleep and recovery.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "signal_2009",
    "short": "Signal et al. (2009)",
    "full": "Signal TL et al. Flight crew fatigue during multi-sector operations.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "signal_2013",
    "short": "Signal et al. (2013)",
    "full": "Signal TL, Gander PH, van den Berg MJ, Graeber RC. In-flight sleep of flight crew during a 7-hour rest break: implications for research and flight safety. Sleep. 2013;36:109-115.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.5665/sleep.2312",
    "url": "https://doi.org/10.5665/sleep.2312",
    "application": "In-flight rest",
    "relevance": "Measures sleep during a seven-hour in-flight rest opportunity.",
    "limitation": "Does not establish a universal hotel-sleep efficiency or validate all rest-facility multipliers."
  },
  {
    "key": "signal_2014",
    "short": "Signal et al. (2014)",
    "full": "Signal TL, Mulrine HM, van den Berg MJ, Smith AA, Gander PH, Serfontein W. Mitigating and monitoring flight crew fatigue on a westward ultra-long-range flight. Aviat Space Environ Med. 2014;85:1199-1208.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3357/asem.4034.2014",
    "url": "https://doi.org/10.3357/asem.4034.2014",
    "application": "Pre-duty naps and ULR",
    "relevance": "Reports fatigue management observations from a westward ultra-long-range operation.",
    "limitation": "Aerowake’s nap length, timing ramp and habit settings are assumptions informed by this evidence."
  },
  {
    "key": "gander_2013",
    "short": "Gander et al. (2013)",
    "full": "Gander PH, Signal TL, van den Berg MJ, Mulrine HM, Jay SM, Jim Mangie C. In-flight sleep, pilot fatigue and Psychomotor Vigilance Task performance on ultra-long range versus long range flights. J Sleep Res. 2013;22:697-706.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1111/jsr.12071",
    "url": "https://doi.org/10.1111/jsr.12071",
    "application": "In-flight rest",
    "relevance": "Examines sleep, fatigue and measured vigilance on long-range and ultra-long-range flights.",
    "limitation": "Crew, route and rest conditions matter; do not assume a fixed personal benefit."
  },
  {
    "key": "gander_2014",
    "short": "Gander et al. (2014)",
    "full": "Gander PH, Mulrine HM, van den Berg MJ, Smith AA, Signal TL, Wu LJ, Belenky G. Pilot fatigue: relationships with departure and arrival times, flight duration, and direction. Aviat Space Environ Med. 2014;85:833-840.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3357/asem.3963.2014",
    "url": "https://doi.org/10.3357/asem.3963.2014",
    "application": "Background research",
    "relevance": "Provides scientific context for aviation fatigue.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "roach_2012",
    "short": "Roach et al. (2012)",
    "full": "Roach GD, Sargent C, Darwent D, Dawson D. Duty periods with early start times restrict the amount of sleep obtained by short-haul airline pilots. Accid Anal Prev. 2012;45 Suppl:22-26.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.aap.2011.09.020",
    "url": "https://doi.org/10.1016/j.aap.2011.09.020",
    "application": "Early reports",
    "relevance": "Connects early duty starts with reduced sleep in short-haul pilots.",
    "limitation": "Roster-inferred bedtime and wake time still need pilot review."
  },
  {
    "key": "rempe_2025",
    "short": "Rempe et al. (2025)",
    "full": "Rempe MJ, Rasmussen I, Gregory K, Johnson C, Hsin M, Flynn-Evans E, Lamp A, Hilditch CJ. Layover start timing predicts layover sleep quantity and timing on long-range and ultra-long-range trips. Sleep Adv. 2025;6:zpaf002.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleepadvances/zpaf002",
    "url": "https://doi.org/10.1093/sleepadvances/zpaf002",
    "application": "Layover sleep",
    "relevance": "Links layover start timing with sleep quantity and timing on long-range trips.",
    "limitation": "Sleep-window estimates are not observations of the pilot’s actual sleep."
  },
  {
    "key": "arsintescu_2022",
    "short": "Arsintescu et al. (2022)",
    "full": "Arsintescu L, Pradhan S, Chachad RG, Gregory KB, Mulligan JB, Flynn-Evans EE. Early starts and late finishes both reduce alertness and performance among short-haul airline pilots. J Sleep Res. 2022;31:e13521.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1111/jsr.13521",
    "url": "https://doi.org/10.1111/jsr.13521",
    "application": "Early and late duties",
    "relevance": "Examines sleep, alertness and performance around early starts and late finishes.",
    "limitation": "A group finding does not determine the outcome of a particular duty."
  },
  {
    "key": "bourgeois_2003",
    "short": "Bourgeois-Bougrine et al. (2003)",
    "full": "Bourgeois-Bougrine S, Carbon P, Gounelle C, Mollard R, Coblentz A. Perceived fatigue for short- and long-haul flights: a survey of 739 airline pilots. Aviat Space Environ Med. 2003;74:1072-1077.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "url": "https://pubmed.ncbi.nlm.nih.gov/14556570/",
    "application": "Background research",
    "relevance": "Provides scientific context for aviation fatigue.",
    "limitation": "This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "fuentes_garcia_2021",
    "short": "Fuentes-Garcia et al. (2021)",
    "full": "Fuentes-Garcia JP et al. Physiological responses during flight simulation: heart rate and cortisol.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "cabon_2008",
    "short": "Cabon et al. (2008)",
    "full": "Cabon P et al. Non-linear time-on-task model of cockpit crew fatigue.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "cabon_1993",
    "short": "Cabon et al. (1993)",
    "full": "Cabon P et al. Workload and flight phase related parameters in aircraft cockpits.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "gander_1994",
    "short": "Gander et al. (1994)",
    "full": "Gander PH et al. Flight crew fatigue V: duty period scheduling.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "hamann_2023",
    "short": "Hamann & Carstengerdes (2023)",
    "full": "Hamann A, Carstengerdes N. Assessing the development of mental fatigue during simulated flights with concurrent EEG-fNIRS measurement. Scientific Reports. 2023;13:4738.",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1038/s41598-023-31264-w",
    "url": "https://doi.org/10.1038/s41598-023-31264-w",
    "application": "Background research",
    "relevance": "Provides scientific context for aviation fatigue.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "nesthus_2007",
    "short": "Nesthus et al. (2007)",
    "full": "Nesthus TE et al. Effects of reduced oxygen and cabin altitude on cognitive performance in pilots.",
    "category": "cabin_environment",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "A legacy citation retained for transparency, excluded from the identified-source count.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. The cited title and publication could not be established in this audit. It must not support a quantitative product claim."
  },
  {
    "key": "muhm_2007",
    "short": "Muhm et al. (2007)",
    "full": "Muhm JM, Rock PB, McMullin DL, Jones SP, Lu IL, Eilers KD, Space DR, McMullen A. Effect of aircraft-cabin altitude on passenger discomfort. N Engl J Med. 2007;357:18-27.",
    "category": "cabin_environment",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1056/nejmoa062770",
    "url": "https://doi.org/10.1056/nejmoa062770",
    "application": "Background research",
    "relevance": "Provides scientific context for the cabin environment.",
    "limitation": "Cabin, workload and time-on-task multipliers are not part of the current KSS scoring core. This source does not by itself validate Aerowake or its numerical assumptions."
  },
  {
    "key": "basner_dinges_2011",
    "short": "Basner & Dinges (2011)",
    "full": "Basner M, Dinges DF. Maximizing sensitivity of the psychomotor vigilance test (PVT) to sleep loss. Sleep. 2011;34:581-591.",
    "category": "methodology",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1093/sleep/34.5.581",
    "url": "https://doi.org/10.1093/sleep/34.5.581",
    "application": "Validation methods",
    "relevance": "Explains sensitive measurement of psychomotor vigilance after sleep loss.",
    "limitation": "Aerowake does not measure PVT performance or validate it from KSS alone."
  },
  {
    "key": "akerstedt_2010",
    "short": "Åkerstedt et al. (2010)",
    "full": "Åkerstedt T et al. Microsleep episodes during driving: sleep propensity and circadian vulnerability.",
    "category": "methodology",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "Retained for audit traceability only.",
    "limitation": "An identifiable source for the cited microsleep formula has not been established; do not interpret predicted severe sleepiness as microsleep probability."
  },
  {
    "key": "easa_oro_ftl",
    "short": "EASA ORO.FTL (2014)",
    "full": "Commission Regulation (EU) No 83/2014, amending Regulation (EU) No 965/2012 as regards flight and duty time limitations and rest requirements. Read with current amendments and the applicable operating framework.",
    "category": "regulation",
    "sourceType": "regulation",
    "verification": "identified",
    "url": "https://eur-lex.europa.eu/eli/reg/2014/83/oj",
    "application": "Duty and rest checks",
    "relevance": "Public flight and duty limitations and rest requirements for the applicable EASA framework.",
    "limitation": "Applicability, approved variations, crew context and complete boundary history must be established separately."
  },
  {
    "key": "easa_amc1_105",
    "short": "EASA Air Operations: ORO.FTL and guidance",
    "full": "EASA Easy Access Rules for Air Operations: ORO.FTL, associated certification specifications, acceptable means of compliance and guidance material.",
    "category": "regulation",
    "sourceType": "regulation",
    "verification": "identified",
    "url": "https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-air-operations-regulation-eu-no-9652012",
    "application": "Regulatory interpretation",
    "relevance": "EASA consolidated Air Operations rules, certification specifications and guidance.",
    "limitation": "The WOCL definition is in ORO.FTL.105; maximum FDP tables are in ORO.FTL.205. Always check the applicable revision and approvals."
  },
  {
    "key": "dawson_mcculloch_2005",
    "short": "Dawson & McCulloch (2005)",
    "full": "Dawson D, McCulloch K. Managing fatigue: it's about sleep. Sleep Med Rev. 2005;9:365-380.",
    "category": "methodology",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.smrv.2005.03.002",
    "url": "https://doi.org/10.1016/j.smrv.2005.03.002",
    "application": "Prior sleep and wake",
    "relevance": "Provides a sleep-based approach to fatigue risk management and prior sleep/wake screening.",
    "limitation": "A screening check does not certify fitness for duty or replace the operator’s procedures."
  },
  {
    "key": "akerstedt_gillberg_1990",
    "short": "Åkerstedt & Gillberg (1990)",
    "full": "Akerstedt T, Gillberg M. Subjective and objective sleepiness in the active individual. Int J Neurosci. 1990;52:29-37.",
    "category": "methodology",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3109/00207459008994241",
    "url": "https://doi.org/10.3109/00207459008994241",
    "application": "KSS measurement",
    "relevance": "Foundational research relating subjective and objective sleepiness in active people.",
    "limitation": "A predicted KSS is distinct from a pilot’s reported KSS rating."
  },
  {
    "key": "akerstedt_sleepiness_2014",
    "short": "Åkerstedt et al. (2014)",
    "full": "Akerstedt T, Anund A, Axelsson J, Kecklund G. Subjective sleepiness is a sensitive indicator of insufficient sleep and impaired waking function. J Sleep Res. 2014;23:240-252.",
    "category": "methodology",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1111/jsr.12158",
    "url": "https://doi.org/10.1111/jsr.12158",
    "application": "KSS interpretation",
    "relevance": "Reviews subjective sleepiness as an indicator of insufficient sleep and impaired waking function.",
    "limitation": "Aerowake’s five named bands and midpoint thresholds are application policy, not regulatory limits."
  },
  {
    "key": "caldwell_2009",
    "short": "Caldwell et al. (2009)",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3357/asem.2435.2009",
    "url": "https://doi.org/10.3357/asem.2435.2009",
    "full": "Caldwell JA, Mallis MM, Caldwell JL, Paul MA, Miller JC, Neri DF, Aerospace Medical Association Fatigue Countermeasures Subcommittee of the Aerospace Human Factors Committee. Fatigue countermeasures in aviation. Aviat Space Environ Med. 2009;80:29-59.",
    "application": "Countermeasures",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "Recommendations must follow applicable operating procedures; this source does not validate a particular personal benefit or the complete Aerowake forecast."
  },
  {
    "key": "ker_2010",
    "short": "Ker et al. (2010)",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1002/14651858.cd008508",
    "url": "https://doi.org/10.1002/14651858.cd008508",
    "full": "Ker K, Edwards PJ, Felix LM, Blackhall K, Roberts I. Caffeine for the prevention of injuries and errors in shift workers. Cochrane Database Syst Rev. 2010;:CD008508.",
    "application": "Caffeine evidence",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "Caffeine effects depend on timing, sensitivity and prior sleep. It is not a substitute for sleep or evidence of fitness for duty."
  },
  {
    "key": "kamimori_2015",
    "short": "Kamimori et al. (2015)",
    "category": "sleep",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1007/s00213-014-3834-5",
    "url": "https://doi.org/10.1007/s00213-014-3834-5",
    "full": "Kamimori GH, McLellan TM, Tate CM, Voss DM, Niro P, Lieberman HR. Caffeine improves reaction time, vigilance and logical reasoning during extended periods with restricted opportunities for sleep. Psychopharmacology (Berl). 2015;232:2031-2042.",
    "application": "Caffeine evidence",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "Caffeine effects depend on timing, sensitivity and prior sleep. It is not a substitute for sleep or evidence of fitness for duty."
  },
  {
    "key": "akerstedt_folkard_1997",
    "short": "Åkerstedt & Folkard (1997)",
    "category": "model",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3109/07420529709001149",
    "url": "https://doi.org/10.3109/07420529709001149",
    "full": "Akerstedt T, Folkard S. The three-process model of alertness and its extension to performance, sleep latency, and sleep length. Chronobiol Int. 1997;14:115-123.",
    "application": "Scientific foundation",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "Recommendations must follow applicable operating procedures; this source does not validate a particular personal benefit or the complete Aerowake forecast."
  },
  {
    "key": "ingre_2006",
    "short": "Ingre et al. (2006)",
    "category": "methodology",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1111/j.1365-2869.2006.00504.x",
    "url": "https://doi.org/10.1111/j.1365-2869.2006.00504.x",
    "full": "Ingre M, Akerstedt T, Peters B, Anund A, Kecklund G. Subjective sleepiness, simulated driving performance and blink duration: examining individual differences. J Sleep Res. 2006;15:47-53.",
    "application": "Sleepiness interpretation",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "This driving study does not calibrate pilot accident probability or prove that a particular KSS predicts a microsleep."
  },
  {
    "key": "rosekind_1996",
    "short": "Rosekind et al. (1996)",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1080/08964289.1996.9933753",
    "url": "https://doi.org/10.1080/08964289.1996.9933753",
    "full": "Rosekind MR, Gander PH, Gregory KB, Smith RM, Miller DL, Oyung R, Webbon LL, Johnson JM. Managing fatigue in operational settings. 1: Physiological considerations and countermeasures. Behav Med. 1996;21:157-165.",
    "application": "Countermeasures",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "Recommendations must follow applicable operating procedures; this source does not validate a particular personal benefit or the complete Aerowake forecast."
  },
  {
    "key": "rosekind_1994",
    "short": "Rosekind et al. (1994)",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1177/001872089403600212",
    "url": "https://doi.org/10.1177/001872089403600212",
    "full": "Rosekind MR, Gander PH, Miller DL, Gregory KB, Smith RM, Weldon KJ, Co EL, McNally KL, Lebacqz JV. Fatigue in operational settings: examples from the aviation environment. Hum Factors. 1994;36:327-338.",
    "application": "Countermeasures",
    "relevance": "Provides context for fatigue reporting and reviewing countermeasures.",
    "limitation": "The previous report cited an unconfirmed SAE 942130 record. This entry identifies the 1994 aviation-fatigue review; it does not validate a universal post-nap recovery time."
  },
  {
    "key": "holmes_2012",
    "short": "Holmes et al. (2012)",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.1016/j.aap.2011.09.021",
    "url": "https://doi.org/10.1016/j.aap.2011.09.021",
    "full": "Holmes A, Al-Bayat S, Hilditch C, Bourgeois-Bougrine S. Sleep and sleepiness during an ultra long-range flight operation between the Middle East and United States. Accid Anal Prev. 2012;45 Suppl:27-31.",
    "application": "ULR sleep",
    "relevance": "Describes sleep and sleepiness during an ultra-long-range operation.",
    "limitation": "Route-specific observations do not establish a universal nap duration or personal benefit."
  },
  {
    "key": "signal_2024",
    "short": "Signal et al. (2024)",
    "category": "aviation",
    "sourceType": "journal",
    "verification": "identified",
    "doi": "10.3389/fenvh.2023.1329203",
    "url": "https://doi.org/10.3389/fenvh.2023.1329203",
    "full": "Signal TL, van den Berg MJ, Zaslona JL, et al. Managing the challenge of fatigue for pilots operating ultra-long range flights. Frontiers in Environmental Health. 2024;2:1329203.",
    "application": "Pre-duty naps and ULR",
    "relevance": "Reports fatigue management in ultra-long-range operations, including pre-flight sleep.",
    "limitation": "Nap habits vary between individuals and operations. The model’s timing ramp and maximum nap duration remain assumptions."
  },
  {
    "key": "icao_9966",
    "short": "ICAO Doc 9966 (2016)",
    "category": "regulation",
    "sourceType": "report",
    "verification": "identified",
    "url": "https://www.icao.int/safety/fatiguemanagement/FRMS%20Tools/Doc%209966.FRMS.2016%20Edition.en.pdf",
    "full": "International Civil Aviation Organization. Manual for the Oversight of Fatigue Management Approaches. Doc 9966, second edition; 2016.",
    "application": "Fatigue risk management",
    "relevance": "Describes the oversight framework for managing fatigue in aviation.",
    "limitation": "Guidance is distinct from a journal study and does not certify Aerowake or establish operator approval."
  },
  {
    "key": "spencer_robertson_2002",
    "short": "Spencer & Robertson (2002)",
    "full": "Spencer & Robertson (2002). Incomplete citation previously attached to in-flight rest advice; no title or publication identifier was supplied.",
    "category": "aviation",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "Retained for audit traceability; excluded from identified-source counts.",
    "limitation": "Do not use this unresolved record to justify a quantitative or operational recommendation."
  },
  {
    "key": "akerstedt_gillberg_1986",
    "short": "Åkerstedt & Gillberg (1986)",
    "full": "Åkerstedt & Gillberg (1986). Legacy sleep-estimation comment cites J Sleep Res for an evening wake-maintenance claim; the referenced publication was not established.",
    "category": "circadian",
    "sourceType": "unresolved",
    "verification": "unresolved",
    "application": "Unresolved citation",
    "relevance": "Retained for audit traceability; excluded from identified-source counts.",
    "limitation": "Do not use this unresolved record to justify a quantitative or operational recommendation."
  }
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

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  journal: 'Journal article', report: 'Research report', regulation: 'Regulation & guidance', unresolved: 'Unresolved legacy citation',
};

export const REFERENCE_STATS = {
  total: ALL_REFERENCES.length,
  journal: ALL_REFERENCES.filter(ref => ref.sourceType === 'journal').length,
  guidance: ALL_REFERENCES.filter(ref => ref.sourceType === 'regulation' || ref.sourceType === 'report').length,
  unresolved: ALL_REFERENCES.filter(ref => ref.verification === 'unresolved').length,
};

/** Stable links also accept old API aliases without changing stored records. */
export function evidenceHref(key?: string): string {
  const params = new URLSearchParams({ section: 'references' });
  if (key) params.set('source', key === 'roach_2025' ? 'rempe_2025' : key);
  return `/learn?${params.toString()}`;
}

export function matchesReference(ref: Reference, query: string): boolean {
  const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const terms = normalise(query).trim().split(/\s+/).filter(Boolean);
  const haystack = normalise([ref.short, ref.full, ref.doi, ref.application, ref.relevance, ref.category].join(' '));
  return terms.every(term => haystack.includes(term));
}
