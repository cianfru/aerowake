import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ReportMethodology() {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        9. Methodology & References
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-medium print:text-black">Biomathematical Fatigue Model</h4>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground print:text-gray-700">
            This report uses the Three Process Model of alertness (Åkerstedt &amp; Folkard, 1997) in the
            form validated on airline crew by Ingre et al. (2014, model 5c). It predicts sleepiness on the
            Karolinska Sleepiness Scale (KSS, 1–9) from three processes:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ProcessCard
              process="S"
              name="Homeostatic Sleep Pressure"
              description="Builds during wakefulness and recovers during sleep, with a 'brake' that slows recovery near full restoration. Up to ~5.5 KSS points between fully rested and depleted."
              reference="Ingre et al., 2014; Åkerstedt & Folkard, 1997"
            />
            <ProcessCard
              process="C"
              name="Circadian Rhythm"
              description="~24h body clock, lowest in the early-morning body-clock hours (WOCL). Worth ~2.3 KSS points peak to trough. Re-adapts to a new time zone at ~30% of the remaining difference per day."
              reference="Ingre et al., 2014"
            />
            <ProcessCard
              process="U"
              name="Ultradian Rhythm"
              description="A small 12-hour component (≤0.5 KSS) that captures the post-lunch dip."
              reference="Ingre et al., 2014"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground print:text-gray-700">
            Predicted KSS = 9.68 − 0.46·(S + C + U). The 20–100 index shown alongside is a linear
            re-expression (index = 110 − 10·KSS); it is not a percentage and not alcohol-equivalent. Risk
            bands: low KSS &lt; 5.5, moderate 5.5–6.5, high 6.5–7.5, critical 7.5–8.5, extreme ≥ 8.5.
            KSS ≥ 7 is associated with physiological signs of sleepiness (Åkerstedt et al., 2014). The
            90th-percentile KSS and P(KSS ≥ 7) come from the published individual-difference and ordinal
            models. Sleep inertia, time-on-task, workload and cabin hypoxia are not part of the score; the
            7-day sleep deficit is reported separately. Predictions describe a group-average pilot
            (typical error ±1.4 KSS) and are not a fitness-to-fly determination.
          </p>

          {/* References */}
          <div className="border-t border-border/30 pt-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 print:text-gray-600">
              REFERENCES
            </h4>
            <div className="space-y-1.5 text-[10px] text-muted-foreground print:text-gray-600 leading-relaxed">
              <Reference text="Åkerstedt, T. & Folkard, S. (1997). The three-process model of alertness and its extension to performance. Sleep, 20(4), 282-292." />
              <Reference text="Åkerstedt, T., Anund, A., Axelsson, J. & Kecklund, G. (2014). Subjective sleepiness is a sensitive indicator of insufficient sleep and impaired waking function. J Sleep Res, 23(3), 240-252." />
              <Reference text="Åkerstedt, T. & Gillberg, M. (1990). Subjective and objective sleepiness in the active individual. Int J Neurosci, 52(1-2), 29-37." />
              <Reference text="Belenky, G. et al. (2003). Patterns of performance degradation and restoration during sleep restriction and subsequent recovery. J Sleep Res, 12(1), 1-12." />
              <Reference text="Caldwell, J.A. et al. (2009). Fatigue countermeasures in aviation. Aviation, Space, and Environmental Medicine, 80(1), 29-59." />
              <Reference text="Ingre, M., Van Leeuwen, W., Klemets, T. et al. (2014). Validating and extending the three process model of alertness in airline operations. PLoS ONE, 9(10), e108679." />
              <Reference text="ICAO (2016). Doc 9966: Manual for the Oversight of Fatigue Management Approaches (2nd ed.)." />
              <Reference text="Kamimori, G.H. et al. (2015). Caffeine improves reaction time, vigilance and logical reasoning. Aviation, Space, and Environmental Medicine, 86(8), 700-706." />
              <Reference text="Ker, K. et al. (2010). Caffeine for the prevention of injuries and errors in shift workers. Cochrane Database of Systematic Reviews, 5." />
              <Reference text="Kitamura, S. et al. (2016). Estimating individual optimal sleep duration and potential sleep debt. Scientific Reports, 6, 35812." />
              <Reference text="Rosekind, M.R. et al. (1994). Alertness management in long-haul flight operations. SAE Technical Paper 942130." />
              <Reference text="Signal, T.L. et al. (2013). In-flight sleep of flight crew during a 7-hour rest break. Aviation, Space, and Environmental Medicine, 84(5), 471-476." />
              <Reference text="Van Dongen, H.P.A. et al. (2003). The cumulative cost of additional wakefulness. Sleep, 26(2), 117-126." />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="border-t border-border/30 pt-3">
            <p className="text-[10px] text-muted-foreground/70 italic print:text-gray-500">
              Disclaimer: This report is generated by a biomathematical fatigue model and provides
              predictions based on mathematical modeling of human sleep-wake physiology. Predictions
              are estimates and may not reflect the actual fatigue state of any individual pilot.
              Individual differences in sleep need, caffeine sensitivity, and fatigue resistance
              can significantly affect real-world performance. This report does not replace
              professional medical judgment or regulatory compliance assessment.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ProcessCard({ process, name, description, reference }: {
  process: string;
  name: string;
  description: string;
  reference: string;
}) {
  const colors: Record<string, string> = {
    S: 'text-red-400 bg-red-400/10 border-red-400/30',
    C: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    U: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  };
  const colorClass = colors[process] ?? 'text-primary bg-primary/10 border-primary/30';

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colorClass} print:bg-gray-50 print:border-gray-200`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold font-mono">{process}</span>
        <span className="text-[10px] font-medium">{name}</span>
      </div>
      <p className="text-[10px] leading-relaxed opacity-80 print:text-gray-700">{description}</p>
      <p className="text-[9px] opacity-60 mt-1 print:text-gray-500">{reference}</p>
    </div>
  );
}

function Reference({ text }: { text: string }) {
  return <p className="pl-4 -indent-4">{text}</p>;
}
