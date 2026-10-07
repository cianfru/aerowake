"""
Strategy References & Confidence Basis
=======================================

Identified scientific references and heuristic confidence explanations
for each sleep strategy type. Extracted from BorbelyFatigueModel
for maintainability — this is static reference data. Citation metadata is aligned
with the evidence catalogue audited in docs/SCIENCE_SOURCE_AUDIT.md. Confidence
values describe modelling assumptions, not calibrated probabilities.
"""

from typing import List, Dict


def get_confidence_basis(strategy) -> str:
    """Explain the sleep assumption without implying a calibrated probability."""
    basis = {
        'normal': 'Estimated from your usual night and the available pre-duty sleep window.',
        'early_bedtime': 'An early report constrains wake time. Bedtime cannot be assumed to advance equally because of the evening wake-maintenance zone (Roach 2012; Dijk & Czeisler 1994).',
        'afternoon_nap': 'Uses your selected nap habit. Whether and how long pilots nap varies (Signal 2014, 2024); review or remove the estimated nap.',
        'nap': 'Uses your usual night and selected nap habit. Nap timing and duration remain assumptions until you confirm actual sleep (Signal 2014, 2024).',
        'split': 'The schedule divides the estimated sleep opportunity. Split sleep has been studied in laboratory settings, but the model’s chosen blocks are assumptions (Jackson 2014; Kosmadopoulos 2014).',
        'split_sleep': 'The schedule divides the estimated sleep opportunity; review both blocks (Jackson 2014; Kosmadopoulos 2014).',
        'anchor': 'Assumes sleep stays partly aligned with home-base time. Individual adaptation differs (Minors & Waterhouse 1981).',
        'restricted': 'The available rest interval constrains the estimated sleep; actual sleep may be shorter.',
        'extended': 'A longer rest permits an estimated recovery sleep. Its length is an application assumption (Banks 2010).',
        'augmented_3_pilot': 'Pre-departure sleep is informed by aviation sleep studies; actual preparation and crew rest vary (Signal 2014; Gander 2013).',
        'ulr_pre_duty': 'Pre-departure sleep is informed by aviation sleep studies; confirm your preparation and selected rest allocation (Signal 2014; Gander 2013).',
        'recovery': 'Assumes a recovery opportunity at home. Recovery from repeated short sleep can take multiple nights (Banks 2010).',
        'post_duty_recovery': 'Estimates sleep after release using the available interval and body-clock timing. Duration and quality remain assumptions (Rempe 2025; Banks 2010).',
        'inter_duty_recovery': 'Estimates sleep between duties using layover timing and the available interval. Duration and quality remain assumptions (Rempe 2025; Banks 2010).',
    }
    return basis.get(strategy.strategy_type, 'Estimated from the schedule and selected sleep habits. Assumption support is a heuristic, not a probability that sleep will occur.')


# ============================================================================
# COMMON REFERENCES (shared across all strategies)
# ============================================================================

_COMMON_REFS: List[Dict[str, str]] = [{'key': 'akerstedt_2014',
  'short': 'Ingre et al. (2014)',
  'full': 'Ingre M, Van Leeuwen W, Klemets T, Ullvetter C, Hough S, Kecklund G, Karlsson D, Åkerstedt T. '
          'Validating and extending the three process model of alertness in airline operations. PLoS One. '
          '2014;9:e108679.'},
 {'key': 'borbely_1982',
  'short': 'Borbély (1982)',
  'full': 'Borbély AA. A two process model of sleep regulation. Hum Neurobiol. 1982;1:195-204.'},
 {'key': 'folkard_1999',
  'short': 'Folkard & Åkerstedt (1999)',
  'full': 'Folkard S, Akerstedt T, Macdonald I, Tucker P, Spencer MB. Beyond the three-process model of '
          'alertness: estimating phase, time on shift, and successive night effects. J Biol Rhythms. '
          '1999;14:577-587.'},
 {'key': 'dijk_czeisler_1995',
  'short': 'Dijk & Czeisler (1995)',
  'full': 'Dijk DJ, Czeisler CA. Contribution of the circadian pacemaker and the sleep homeostat to sleep '
          'propensity, sleep structure, electroencephalographic slow waves, and sleep spindle activity in '
          'humans. J Neurosci. 1995;15:3526-3538.'},
 {'key': 'belenky_2003',
  'short': 'Belenky et al. (2003)',
  'full': 'Belenky G, Wesensten NJ, Thorne DR, Thomas ML, Sing HC, Redmond DP, Russo MB, Balkin TJ. '
          'Patterns of performance degradation and restoration during sleep restriction and subsequent '
          'recovery: a sleep dose-response study. J Sleep Res. 2003;12:1-12.'},
 {'key': 'kitamura_2016',
  'short': 'Kitamura et al. (2016)',
  'full': 'Kitamura S, Katayose Y, Nakazaki K, Motomura Y, Oba K, Katsunuma R, Terasawa Y, Enomoto M, '
          'Moriguchi Y, Hida A, Mishima K. Estimating individual optimal sleep duration and potential '
          'sleep debt. Sci Rep. 2016;6:35812.'}]

# ============================================================================
# STRATEGY-SPECIFIC REFERENCES
# ============================================================================

_STRATEGY_REFS: Dict[str, List[Dict[str, str]]] = {'normal': [{'key': 'gander_2013',
             'short': 'Gander et al. (2013)',
             'full': 'Gander PH, Signal TL, van den Berg MJ, Mulrine HM, Jay SM, Jim Mangie C. In-flight '
                     'sleep, pilot fatigue and Psychomotor Vigilance Task performance on ultra-long range '
                     'versus long range flights. J Sleep Res. 2013;22:697-706.'}],
 'early_bedtime': [{'key': 'roach_2012',
                    'short': 'Roach et al. (2012)',
                    'full': 'Roach GD, Sargent C, Darwent D, Dawson D. Duty periods with early start times '
                            'restrict the amount of sleep obtained by short-haul airline pilots. Accid '
                            'Anal Prev. 2012;45 Suppl:22-26.'},
                   {'key': 'arsintescu_2022',
                    'short': 'Arsintescu et al. (2022)',
                    'full': 'Arsintescu L, Pradhan S, Chachad RG, Gregory KB, Mulligan JB, Flynn-Evans EE. '
                            'Early starts and late finishes both reduce alertness and performance among '
                            'short-haul airline pilots. J Sleep Res. 2022;31:e13521.'}],
 'nap': [{'key': 'signal_2014',
          'short': 'Signal et al. (2014)',
          'full': 'Signal TL, Mulrine HM, van den Berg MJ, Smith AA, Gander PH, Serfontein W. Mitigating '
                  'and monitoring flight crew fatigue on a westward ultra-long-range flight. Aviat Space '
                  'Environ Med. 2014;85:1199-1208.'},
         {'key': 'gander_2014',
          'short': 'Gander et al. (2014)',
          'full': 'Gander PH, Mulrine HM, van den Berg MJ, Smith AA, Signal TL, Wu LJ, Belenky G. Pilot '
                  'fatigue: relationships with departure and arrival times, flight duration, and '
                  'direction. Aviat Space Environ Med. 2014;85:833-840.'},
         {'key': 'dinges_1987',
          'short': 'Dinges et al. (1987)',
          'full': 'Dinges DF, Orne MT, Whitehouse WG, Orne EC. Temporal placement of a nap for alertness: '
                  'contributions of circadian phase and prior wakefulness. Sleep. 1987;10:313-329.'},
         {'key': 'signal_2024',
          'short': 'Signal et al. (2024)',
          'full': 'Signal TL, van den Berg MJ, Zaslona JL, et al. Managing the challenge of fatigue for '
                  'pilots operating ultra-long range flights. Frontiers in Environmental Health. '
                  '2024;2:1329203.'},
         {'key': 'holmes_2012',
          'short': 'Holmes et al. (2012)',
          'full': 'Holmes A, Al-Bayat S, Hilditch C, Bourgeois-Bougrine S. Sleep and sleepiness during an '
                  'ultra long-range flight operation between the Middle East and United States. Accid Anal '
                  'Prev. 2012;45 Suppl:27-31.'}],
 'afternoon_nap': [{'key': 'dinges_1987',
                    'short': 'Dinges et al. (1987)',
                    'full': 'Dinges DF, Orne MT, Whitehouse WG, Orne EC. Temporal placement of a nap for '
                            'alertness: contributions of circadian phase and prior wakefulness. Sleep. '
                            '1987;10:313-329.'},
                   {'key': 'signal_2014',
                    'short': 'Signal et al. (2014)',
                    'full': 'Signal TL, Mulrine HM, van den Berg MJ, Smith AA, Gander PH, Serfontein W. '
                            'Mitigating and monitoring flight crew fatigue on a westward ultra-long-range '
                            'flight. Aviat Space Environ Med. 2014;85:1199-1208.'},
                   {'key': 'signal_2024',
                    'short': 'Signal et al. (2024)',
                    'full': 'Signal TL, van den Berg MJ, Zaslona JL, et al. Managing the challenge of '
                            'fatigue for pilots operating ultra-long range flights. Frontiers in '
                            'Environmental Health. 2024;2:1329203.'},
                   {'key': 'holmes_2012',
                    'short': 'Holmes et al. (2012)',
                    'full': 'Holmes A, Al-Bayat S, Hilditch C, Bourgeois-Bougrine S. Sleep and sleepiness '
                            'during an ultra long-range flight operation between the Middle East and '
                            'United States. Accid Anal Prev. 2012;45 Suppl:27-31.'}],
 'anchor': [{'key': 'minors_1981',
             'short': 'Minors & Waterhouse (1981)',
             'full': 'Minors DS, Waterhouse JM. Anchor sleep as a synchronizer of rhythms on abnormal '
                     'routines. Int J Chronobiol. 1981;7:165-188.'},
            {'key': 'minors_1983',
             'short': 'Minors & Waterhouse (1983)',
             'full': "Minors DS, Waterhouse JM. Does 'anchor sleep' entrain circadian rhythms? Evidence "
                     'from constant routine studies. J Physiol. 1983;345:451-467.'},
            {'key': 'waterhouse_2007',
             'short': 'Waterhouse et al. (2007)',
             'full': 'Waterhouse J, Reilly T, Atkinson G, Edwards B. Jet lag: trends and coping '
                     'strategies. Lancet. 2007;369:1117-1129.'}],
 'split': [{'key': 'jackson_2014',
            'short': 'Jackson et al. (2014)',
            'full': 'Jackson ML, Banks S, Belenky G. Investigation of the effectiveness of a split sleep '
                    'schedule in sustaining sleep and maintaining performance. Chronobiol Int. '
                    '2014;31:1218-1230.'},
           {'key': 'kosmadopoulos_2017',
            'short': 'Kosmadopoulos et al. (2014)',
            'full': 'Kosmadopoulos A, Sargent C, Darwent D, Zhou X, Dawson D, Roach GD. The effects of a '
                    'split sleep-wake schedule on neurobehavioural performance and predictions of '
                    'performance under conditions of forced desynchrony. Chronobiol Int. '
                    '2014;31:1209-1217.'}],
 'restricted': [{'key': 'belenky_2003',
                 'short': 'Belenky et al. (2003)',
                 'full': 'Belenky G, Wesensten NJ, Thorne DR, Thomas ML, Sing HC, Redmond DP, Russo MB, '
                         'Balkin TJ. Patterns of performance degradation and restoration during sleep '
                         'restriction and subsequent recovery: a sleep dose-response study. J Sleep Res. '
                         '2003;12:1-12.'},
                {'key': 'van_dongen_2003',
                 'short': 'Van Dongen et al. (2003)',
                 'full': 'Van Dongen HP, Maislin G, Mullington JM, Dinges DF. The cumulative cost of '
                         'additional wakefulness: dose-response effects on neurobehavioral functions and '
                         'sleep physiology from chronic sleep restriction and total sleep deprivation. '
                         'Sleep. 2003;26:117-126.'}],
 'extended': [{'key': 'banks_2010',
               'short': 'Banks et al. (2010)',
               'full': 'Banks S, Van Dongen HP, Maislin G, Dinges DF. Neurobehavioral dynamics following '
                       'chronic sleep restriction: dose-response effects of one night for recovery. Sleep. '
                       '2010;33:1013-1026.'},
              {'key': 'kitamura_2016',
               'short': 'Kitamura et al. (2016)',
               'full': 'Kitamura S, Katayose Y, Nakazaki K, Motomura Y, Oba K, Katsunuma R, Terasawa Y, '
                       'Enomoto M, Moriguchi Y, Hida A, Mishima K. Estimating individual optimal sleep '
                       'duration and potential sleep debt. Sci Rep. 2016;6:35812.'}],
 'recovery': [{'key': 'gander_2014',
               'short': 'Gander et al. (2014)',
               'full': 'Gander PH, Mulrine HM, van den Berg MJ, Smith AA, Signal TL, Wu LJ, Belenky G. '
                       'Pilot fatigue: relationships with departure and arrival times, flight duration, '
                       'and direction. Aviat Space Environ Med. 2014;85:833-840.'},
              {'key': 'banks_2010',
               'short': 'Banks et al. (2010)',
               'full': 'Banks S, Van Dongen HP, Maislin G, Dinges DF. Neurobehavioral dynamics following '
                       'chronic sleep restriction: dose-response effects of one night for recovery. Sleep. '
                       '2010;33:1013-1026.'},
              {'key': 'van_dongen_2003',
               'short': 'Van Dongen et al. (2003)',
               'full': 'Van Dongen HP, Maislin G, Mullington JM, Dinges DF. The cumulative cost of '
                       'additional wakefulness: dose-response effects on neurobehavioral functions and '
                       'sleep physiology from chronic sleep restriction and total sleep deprivation. '
                       'Sleep. 2003;26:117-126.'}],
 'post_duty_recovery': [{'key': 'roach_2025',
                         'short': 'Rempe et al. (2025)',
                         'full': 'Rempe MJ, Rasmussen I, Gregory K, Johnson C, Hsin M, Flynn-Evans E, Lamp '
                                 'A, Hilditch CJ. Layover start timing predicts layover sleep quantity and '
                                 'timing on long-range and ultra-long-range trips. Sleep Adv. '
                                 '2025;6:zpaf002.'}],
 'ulr_pre_duty': [{'key': 'signal_2014',
                   'short': 'Signal et al. (2014)',
                   'full': 'Signal TL, Mulrine HM, van den Berg MJ, Smith AA, Gander PH, Serfontein W. '
                           'Mitigating and monitoring flight crew fatigue on a westward ultra-long-range '
                           'flight. Aviat Space Environ Med. 2014;85:1199-1208.'},
                  {'key': 'gander_2013',
                   'short': 'Gander et al. (2013)',
                   'full': 'Gander PH, Signal TL, van den Berg MJ, Mulrine HM, Jay SM, Jim Mangie C. '
                           'In-flight sleep, pilot fatigue and Psychomotor Vigilance Task performance on '
                           'ultra-long range versus long range flights. J Sleep Res. 2013;22:697-706.'},
                  {'key': 'signal_2013',
                   'short': 'Signal et al. (2013)',
                   'full': 'Signal TL, Gander PH, van den Berg MJ, Graeber RC. In-flight sleep of flight '
                           'crew during a 7-hour rest break: implications for research and flight safety. '
                           'Sleep. 2013;36:109-115.'}],
 'inter_duty_recovery': [{'key': 'roach_2025',
                          'short': 'Rempe et al. (2025)',
                          'full': 'Rempe MJ, Rasmussen I, Gregory K, Johnson C, Hsin M, Flynn-Evans E, '
                                  'Lamp A, Hilditch CJ. Layover start timing predicts layover sleep '
                                  'quantity and timing on long-range and ultra-long-range trips. Sleep '
                                  'Adv. 2025;6:zpaf002.'},
                         {'key': 'banks_2010',
                          'short': 'Banks et al. (2010)',
                          'full': 'Banks S, Van Dongen HP, Maislin G, Dinges DF. Neurobehavioral dynamics '
                                  'following chronic sleep restriction: dose-response effects of one night '
                                  'for recovery. Sleep. 2010;33:1013-1026.'},
                         {'key': 'kitamura_2016',
                          'short': 'Kitamura et al. (2016)',
                          'full': 'Kitamura S, Katayose Y, Nakazaki K, Motomura Y, Oba K, Katsunuma R, '
                                  'Terasawa Y, Enomoto M, Moriguchi Y, Hida A, Mishima K. Estimating '
                                  'individual optimal sleep duration and potential sleep debt. Sci Rep. '
                                  '2016;6:35812.'},
                         {'key': 'arsintescu_2022',
                          'short': 'Arsintescu et al. (2022)',
                          'full': 'Arsintescu L, Pradhan S, Chachad RG, Gregory KB, Mulligan JB, '
                                  'Flynn-Evans EE. Early starts and late finishes both reduce alertness '
                                  'and performance among short-haul airline pilots. J Sleep Res. '
                                  '2022;31:e13521.'},
                         {'key': 'national_academies_2011',
                          'short': 'National Academies (2011)',
                          'full': 'National Research Council. The Effects of Commuting on Pilot Fatigue. '
                                  'Washington, DC: The National Academies Press; 2011.'},
                         {'key': 'dijk_czeisler_1994',
                          'short': 'Dijk & Czeisler (1994)',
                          'full': 'Dijk DJ, Czeisler CA. Paradoxical timing of the circadian rhythm of '
                                  'sleep propensity serves to consolidate sleep and wakefulness in humans. '
                                  'Neurosci Lett. 1994;166:63-68.'}]}


def get_strategy_references(strategy_type: str) -> list:
    """Return identified research and report sources relevant to this sleep strategy."""
    return _COMMON_REFS + _STRATEGY_REFS.get(strategy_type, [])
