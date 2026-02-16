"""
Strategy References & Confidence Basis
=======================================

Peer-reviewed scientific references and confidence explanations
for each sleep strategy type. Extracted from BorbelyFatigueModel
for maintainability — this is static reference data.
"""

from typing import List, Dict


def get_confidence_basis(strategy) -> str:
    """Human-readable explanation of confidence value for frontend display."""
    st = strategy.strategy_type
    c = strategy.confidence

    if st == 'normal':
        if c >= 0.90:
            return 'High confidence — standard night sleep with short pre-duty wake period'
        elif c >= 0.80:
            return 'Good confidence — normal sleep pattern, moderate wake period before duty'
        else:
            return 'Moderate confidence — long wake period before duty increases uncertainty'
    elif st == 'early_bedtime':
        return (
            f'Moderate confidence ({c:.0%}) — pilots cannot fully advance bedtime '
            'for early reports due to circadian wake maintenance zone '
            '(Roach et al. 2012, Arsintescu et al. 2022)'
        )
    elif st == 'afternoon_nap':
        return (
            f'Moderate confidence ({c:.0%}) — Signal et al. (2014) found only '
            '54% of crew nap before evening departures; nap timing and '
            'duration vary between individuals'
        )
    elif st == 'split_sleep':
        return (
            f'Lower confidence ({c:.0%}) — anchor sleep concept validated '
            'in laboratory (Minors & Waterhouse 1983) but limited field '
            'data on pilot adoption of this specific pattern'
        )
    elif st == 'recovery':
        return (
            f'High confidence ({c:.0%}) — home environment, no duty constraints. '
            'Recovery from sleep debt is exponential over multiple nights '
            '(Banks et al. 2010)'
        )
    elif st == 'post_duty_recovery':
        return (
            f'{"Good" if c >= 0.88 else "Moderate"} confidence ({c:.0%}) — '
            f'post-duty recovery sleep. WOCL evaluated against pilot biological '
            f'clock (home-base time), not local time'
        )
    elif st == 'inter_duty_recovery':
        if c >= 0.75:
            return (
                f'Good confidence ({c:.0%}) — single inter-duty recovery block '
                f'with circadian-gated wake and homeostatic duration scaling '
                f'(Signal 2013, Banks 2010)'
            )
        elif c >= 0.55:
            return (
                f'Moderate confidence ({c:.0%}) — inter-duty recovery with '
                f'constrained sleep opportunity or layover variability'
            )
        else:
            return (
                f'Low confidence ({c:.0%}) — severely constrained inter-duty '
                f'recovery; schedule pressure limits sleep opportunity'
            )
    return f'Confidence: {c:.0%}'


# ============================================================================
# COMMON REFERENCES (shared across all strategies)
# ============================================================================

_COMMON_REFS: List[Dict[str, str]] = [
    {
        'key': 'borbely_1982',
        'short': 'Borbely (1982)',
        'full': 'Borbely AA. A two process model of sleep regulation. Hum Neurobiol 1:195-204',
    },
    {
        'key': 'folkard_1999',
        'short': 'Folkard & Åkerstedt (1999)',
        'full': 'Folkard S et al. Beyond the three-process model of alertness. J Biol Rhythms 14(6):577-587',
    },
    {
        'key': 'dawson_reid_1997',
        'short': 'Dawson & Reid (1997)',
        'full': 'Dawson D, Reid K. Fatigue, alcohol and performance impairment. Nature 388:235',
    },
    {
        'key': 'dijk_czeisler_1995',
        'short': 'Dijk & Czeisler (1995)',
        'full': 'Dijk D-J, Czeisler CA. Contribution of the circadian pacemaker and the sleep homeostat. J Neurosci 15:3526-3538',
    },
    {
        'key': 'belenky_2003',
        'short': 'Belenky et al. (2003)',
        'full': 'Belenky G et al. Patterns of performance degradation and restoration during sleep restriction and subsequent recovery. J Sleep Res 12:1-12',
    },
    {
        'key': 'kitamura_2016',
        'short': 'Kitamura et al. (2016)',
        'full': 'Kitamura S et al. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep 6:35812',
    },
]

# ============================================================================
# STRATEGY-SPECIFIC REFERENCES
# ============================================================================

_STRATEGY_REFS: Dict[str, List[Dict[str, str]]] = {
    'normal': [
        {
            'key': 'signal_2009',
            'short': 'Signal et al. (2009)',
            'full': 'Signal TL et al. Flight crew sleep during multi-sector operations. J Sleep Res',
        },
        {
            'key': 'gander_2013',
            'short': 'Gander et al. (2013)',
            'full': 'Gander PH et al. In-flight sleep, pilot fatigue and PVT. J Sleep Res 22(6):697-706',
        },
    ],
    'early_bedtime': [
        {
            'key': 'roach_2012',
            'short': 'Roach et al. (2012)',
            'full': 'Roach GD et al. Duty periods with early start times restrict sleep. Accid Anal Prev 45 Suppl:22-26',
        },
        {
            'key': 'arsintescu_2022',
            'short': 'Arsintescu et al. (2022)',
            'full': 'Arsintescu L et al. Early starts and late finishes reduce alertness. J Sleep Res 31(3):e13521',
        },
    ],
    'nap': [
        {
            'key': 'signal_2014',
            'short': 'Signal et al. (2014)',
            'full': 'Signal TL et al. Mitigating flight crew fatigue on ULR flights. Aviat Space Environ Med 85:1199-1208',
        },
        {
            'key': 'gander_2014',
            'short': 'Gander et al. (2014)',
            'full': 'Gander PH et al. Pilot fatigue: departure/arrival times. Aviat Space Environ Med 85(8):833-40',
        },
        {
            'key': 'dinges_1987',
            'short': 'Dinges et al. (1987)',
            'full': 'Dinges DF et al. Temporal placement of a nap for alertness. Sleep 10(4):313-329',
        },
    ],
    'afternoon_nap': [
        {
            'key': 'dinges_1987',
            'short': 'Dinges et al. (1987)',
            'full': 'Dinges DF et al. Temporal placement of a nap for alertness. Sleep 10(4):313-329',
        },
        {
            'key': 'signal_2014',
            'short': 'Signal et al. (2014)',
            'full': 'Signal TL et al. Mitigating flight crew fatigue on ULR flights. Aviat Space Environ Med 85:1199-1208',
        },
    ],
    'anchor': [
        {
            'key': 'minors_1981',
            'short': 'Minors & Waterhouse (1981)',
            'full': 'Minors DS, Waterhouse JM. Anchor sleep as a synchronizer. Int J Chronobiol 8:165-88',
        },
        {
            'key': 'minors_1983',
            'short': 'Minors & Waterhouse (1983)',
            'full': 'Minors DS, Waterhouse JM. Does anchor sleep entrain circadian rhythms? J Physiol 345:1-11',
        },
        {
            'key': 'waterhouse_2007',
            'short': 'Waterhouse et al. (2007)',
            'full': 'Waterhouse J et al. Jet lag: trends and coping strategies. Aviat Space Environ Med 78(5):B1-B10',
        },
    ],
    'split': [
        {
            'key': 'jackson_2014',
            'short': 'Jackson et al. (2014)',
            'full': 'Jackson ML et al. Investigation of the effectiveness of a split sleep schedule. Accid Anal Prev 72:252-261',
        },
        {
            'key': 'kosmadopoulos_2017',
            'short': 'Kosmadopoulos et al. (2017)',
            'full': 'Kosmadopoulos A et al. Split sleep period on sustained performance. Chronobiol Int 34(2):190-196',
        },
    ],
    'restricted': [
        {
            'key': 'belenky_2003',
            'short': 'Belenky et al. (2003)',
            'full': 'Belenky G et al. Patterns of performance degradation and restoration during sleep restriction and subsequent recovery. J Sleep Res 12:1-12',
        },
        {
            'key': 'van_dongen_2003',
            'short': 'Van Dongen et al. (2003)',
            'full': 'Van Dongen HPA et al. The cumulative cost of additional wakefulness. Sleep 26(2):117-126',
        },
    ],
    'extended': [
        {
            'key': 'banks_2010',
            'short': 'Banks et al. (2010)',
            'full': 'Banks S et al. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep 33(8):1013-1026',
        },
        {
            'key': 'kitamura_2016',
            'short': 'Kitamura et al. (2016)',
            'full': 'Kitamura S et al. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep 6:35812',
        },
    ],
    'recovery': [
        {
            'key': 'gander_2014',
            'short': 'Gander et al. (2014)',
            'full': 'Gander PH et al. Pilot fatigue: departure/arrival times. Aviat Space Environ Med 85(8):833-40',
        },
        {
            'key': 'banks_2010',
            'short': 'Banks et al. (2010)',
            'full': 'Banks S et al. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep 33(8):1013-1026',
        },
        {
            'key': 'van_dongen_2003',
            'short': 'Van Dongen et al. (2003)',
            'full': 'Van Dongen HPA et al. The cumulative cost of additional wakefulness. Sleep 26(2):117-126',
        },
    ],
    'post_duty_recovery': [
        {
            'key': 'signal_2013',
            'short': 'Signal et al. (2013)',
            'full': 'Signal TL et al. Sleep on layover: PSG measured hotel sleep efficiency 88%. J Sleep Res 22(6):697-706',
        },
        {
            'key': 'gander_2013',
            'short': 'Gander et al. (2013)',
            'full': 'Gander PH et al. In-flight sleep, pilot fatigue and PVT. J Sleep Res 22(6):697-706',
        },
        {
            'key': 'roach_2025',
            'short': 'Roach et al. (2025)',
            'full': 'Roach GD et al. Layover start timing predicts layover sleep. PMC11879054',
        },
    ],
    'ulr_pre_duty': [
        {
            'key': 'signal_2014',
            'short': 'Signal et al. (2014)',
            'full': 'Signal TL et al. Mitigating and monitoring flight crew fatigue on ULR flights. Aviat Space Environ Med 85:1199-1208',
        },
        {
            'key': 'gander_2013',
            'short': 'Gander et al. (2013)',
            'full': 'Gander PH et al. In-flight sleep, pilot fatigue and PVT. J Sleep Res 22(6):697-706',
        },
        {
            'key': 'signal_2013',
            'short': 'Signal et al. (2013)',
            'full': 'Signal TL et al. Sleep on crew rest facility: PSG measured 70% efficiency. Sleep 36(1):109-118',
        },
    ],
    'inter_duty_recovery': [
        {
            'key': 'signal_2013',
            'short': 'Signal et al. (2013)',
            'full': 'Signal TL et al. Sleep on layover: PSG measured hotel sleep efficiency 88%. J Sleep Res 22(6):697-706',
        },
        {
            'key': 'roach_2025',
            'short': 'Rempe et al. (2025)',
            'full': 'Rempe MJ et al. Layover start timing predicts layover sleep quantity in long-range airline pilots. SLEEP Advances 6(1):zpaf009. PMC11879054',
        },
        {
            'key': 'banks_2010',
            'short': 'Banks et al. (2010)',
            'full': 'Banks S et al. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep 33(8):1013-1026',
        },
        {
            'key': 'kitamura_2016',
            'short': 'Kitamura et al. (2016)',
            'full': 'Kitamura S et al. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep 6:35812',
        },
        {
            'key': 'arsintescu_2022',
            'short': 'Arsintescu et al. (2022)',
            'full': 'Arsintescu L et al. Early starts and late finishes in short-haul aviation: effects on sleep and alertness. J Sleep Res 31(3):e13521',
        },
        {
            'key': 'national_academies_2011',
            'short': 'National Academies (2011)',
            'full': 'National Research Council. The Effects of Commuting on Pilot Fatigue. Washington, DC: The National Academies Press. Ch.5: Sleep Regulation and Circadian Rhythms',
        },
        {
            'key': 'dijk_czeisler_1994',
            'short': 'Dijk & Czeisler (1994)',
            'full': 'Dijk D-J, Czeisler CA. Paradoxical timing of the circadian rhythm of sleep propensity: wake maintenance zone. J Neurosci 14(7):3522-3530',
        },
    ],
}


def get_strategy_references(strategy_type: str) -> list:
    """Return peer-reviewed references supporting this sleep strategy."""
    return _COMMON_REFS + _STRATEGY_REFS.get(strategy_type, [])
