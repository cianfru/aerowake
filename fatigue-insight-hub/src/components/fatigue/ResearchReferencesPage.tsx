import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Brain, Moon, Shield, Plane, FlaskConical } from 'lucide-react';

interface Reference {
  key: string;
  short: string;
  full: string;
  category: 'model' | 'sleep' | 'circadian' | 'aviation' | 'regulation' | 'methodology';
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  model: { label: 'Fatigue Modelling', icon: <Brain className="h-4 w-4" />, color: 'text-primary' },
  sleep: { label: 'Sleep Science', icon: <Moon className="h-4 w-4" />, color: 'text-chart-2' },
  circadian: { label: 'Circadian Rhythm', icon: <FlaskConical className="h-4 w-4" />, color: 'text-warning' },
  aviation: { label: 'Aviation Fatigue', icon: <Plane className="h-4 w-4" />, color: 'text-success' },
  regulation: { label: 'Regulatory', icon: <Shield className="h-4 w-4" />, color: 'text-high' },
  methodology: { label: 'Methodology', icon: <BookOpen className="h-4 w-4" />, color: 'text-muted-foreground' },
};

const ALL_REFERENCES: Reference[] = [
  // Fatigue Modelling
  {
    key: 'borbely_1982',
    short: 'Borbely (1982)',
    full: 'Borbely AA. A two process model of sleep regulation. Hum Neurobiol 1:195-204',
    category: 'model',
  },
  {
    key: 'folkard_1999',
    short: 'Folkard & Akerstedt (1999)',
    full: 'Folkard S et al. Beyond the three-process model of alertness. J Biol Rhythms 14(6):577-587',
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
    key: 'dawson_reid_1997',
    short: 'Dawson & Reid (1997)',
    full: 'Dawson D, Reid K. Fatigue, alcohol and performance impairment. Nature 388:235',
    category: 'model',
  },
  {
    key: 'hursh_2004',
    short: 'Hursh et al. (2004)',
    full: 'Hursh SR et al. Fatigue models for applied research in warfighting. Aviat Space Environ Med 75(3 Suppl):A44-53',
    category: 'model',
  },
  // Circadian Rhythm
  {
    key: 'dijk_czeisler_1995',
    short: 'Dijk & Czeisler (1995)',
    full: 'Dijk D-J, Czeisler CA. Contribution of the circadian pacemaker and the sleep homeostat to sleep propensity, sleep structure and EEG. J Neurosci 15:3526-3538',
    category: 'circadian',
  },
  {
    key: 'dijk_czeisler_1994',
    short: 'Dijk & Czeisler (1994)',
    full: 'Dijk D-J, Czeisler CA. Paradoxical timing of the circadian rhythm of sleep propensity: wake maintenance zone. J Neurosci 14(7):3522-3530',
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
    full: 'Waterhouse J et al. Jet lag: trends and coping strategies. Aviat Space Environ Med 78(5):B1-B10',
    category: 'circadian',
  },
  // Sleep Science
  {
    key: 'banks_2010',
    short: 'Banks et al. (2010)',
    full: 'Banks S et al. Neurobehavioral dynamics following chronic sleep restriction: dose-response effects of one night for recovery. Sleep 33(8):1013-1026',
    category: 'sleep',
  },
  {
    key: 'kitamura_2016',
    short: 'Kitamura et al. (2016)',
    full: 'Kitamura S et al. Estimating individual optimal sleep duration and potential sleep debt. Sci Rep 6:35812',
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
    full: 'Jackson ML et al. Investigation of the effectiveness of a split sleep schedule in sustaining performance. Accid Anal Prev 72:252-261',
    category: 'sleep',
  },
  {
    key: 'kosmadopoulos_2017',
    short: 'Kosmadopoulos et al. (2017)',
    full: 'Kosmadopoulos A et al. The effects of a split sleep-wake schedule on neurobehavioural performance. Chronobiol Int 34(2):190-196',
    category: 'sleep',
  },
  {
    key: 'national_academies_2011',
    short: 'National Academies (2011)',
    full: 'National Research Council. The Effects of Commuting on Pilot Fatigue. Washington, DC: The National Academies Press. Ch.5: Sleep Regulation and Circadian Rhythms',
    category: 'sleep',
  },
  // Aviation Fatigue
  {
    key: 'signal_2009',
    short: 'Signal et al. (2009)',
    full: 'Signal TL et al. Flight crew fatigue during multi-sector operations. J Sleep Res 18:245-253',
    category: 'aviation',
  },
  {
    key: 'signal_2013',
    short: 'Signal et al. (2013)',
    full: 'Signal TL et al. Sleep on layover: PSG measured hotel sleep efficiency 88%. J Sleep Res 22(6):697-706',
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
    full: 'Gander PH et al. In-flight sleep, pilot fatigue and PVT performance. J Sleep Res 22(6):697-706',
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
    key: 'roach_2025',
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
    full: 'Fuentes-Garcia JP et al. Physiological responses during flight simulation: heart rate and cortisol. Sci Rep 11:1-10',
    category: 'aviation',
  },
  // Regulatory
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

// Group references by category
function groupByCategory(refs: Reference[]): Record<string, Reference[]> {
  const groups: Record<string, Reference[]> = {};
  for (const ref of refs) {
    if (!groups[ref.category]) groups[ref.category] = [];
    groups[ref.category].push(ref);
  }
  // Sort each group alphabetically by short name
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.short.localeCompare(b.short));
  }
  return groups;
}

const CATEGORY_ORDER = ['model', 'circadian', 'sleep', 'aviation', 'regulation'];

export function ResearchReferencesPage() {
  const grouped = groupByCategory(ALL_REFERENCES);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Scientific References
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Peer-reviewed studies and regulatory documents underpinning the Aerowake fatigue model.
            All sleep strategies, circadian calculations, and risk thresholds cite these sources.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <Badge variant="outline" className="text-xs">
              {ALL_REFERENCES.length} references
            </Badge>
            {CATEGORY_ORDER.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              const count = grouped[cat]?.length ?? 0;
              if (count === 0) return null;
              return (
                <Badge key={cat} variant="secondary" className="text-xs gap-1">
                  <span className={config.color}>{config.icon}</span>
                  {count} {config.label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {CATEGORY_ORDER.map(cat => {
        const refs = grouped[cat];
        if (!refs || refs.length === 0) return null;
        const config = CATEGORY_CONFIG[cat];

        return (
          <Card key={cat} variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={config.color}>{config.icon}</span>
                {config.label}
                <Badge variant="outline" className="text-[10px] ml-1">{refs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {refs.map(ref => (
                  <div
                    key={ref.key}
                    className="rounded-lg bg-secondary/30 p-3 border border-border/50"
                  >
                    <p className="text-sm font-medium text-foreground mb-0.5">
                      {ref.short}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ref.full}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
