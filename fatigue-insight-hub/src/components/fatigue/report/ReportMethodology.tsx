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
            This report uses the Borbely Two-Process Model of sleep regulation (Borbely, 1982)
            as extended for aviation applications. The model integrates three primary processes:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ProcessCard
              process="S"
              name="Homeostatic Sleep Pressure"
              description="Tracks the accumulation of sleep need during wakefulness and its dissipation during sleep. Higher values indicate greater sleep debt."
              reference="Borbely, 1982; Achermann et al., 1993"
            />
            <ProcessCard
              process="C"
              name="Circadian Rhythm"
              description="Models the ~24h biological clock cycle. Alertness peaks in the afternoon and reaches its nadir during the Window of Circadian Low (02:00–05:59)."
              reference="Czeisler et al., 1999; Åkerstedt & Folkard, 1997"
            />
            <ProcessCard
              process="W"
              name="Sleep Inertia"
              description="Captures the transient grogginess immediately after waking. Dissipates over 15–30 minutes but can be significant if woken during deep sleep."
              reference="Jewett et al., 1999; Tassi & Muzet, 2000"
            />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground print:text-gray-700">
            Additional factors integrated into the performance prediction include time-on-task fatigue
            (Folkard & Åkerstedt, 1999), chronic sleep debt vulnerability (Van Dongen et al., 2003),
            and cabin altitude hypoxia effects (Nesthus et al., 2007). The model output is expressed
            as a composite performance score (0–100%) that maps to validated subjective scales (KSS, Samn-Perelli)
            and objective measures (PVT reaction time).
          </p>

          {/* References */}
          <div className="border-t border-border/30 pt-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 print:text-gray-600">
              REFERENCES
            </h4>
            <div className="space-y-1.5 text-[10px] text-muted-foreground print:text-gray-600 leading-relaxed">
              <Reference text="Åkerstedt, T. & Folkard, S. (1997). The three-process model of alertness and its extension to performance. Sleep, 20(4), 282-292." />
              <Reference text="Åkerstedt, T. & Gillberg, M. (1990). Subjective and objective sleepiness in the active individual. Int J Neurosci, 52(1-2), 29-37." />
              <Reference text="Basner, M. & Dinges, D.F. (2011). Maximizing sensitivity of the PVT to sleep loss. Sleep, 34(5), 581-591." />
              <Reference text="Belenky, G. et al. (2003). Patterns of performance degradation and restoration during sleep restriction and subsequent recovery. J Sleep Res, 12(1), 1-12." />
              <Reference text="Borbely, A.A. (1982). A two process model of sleep regulation. Human Neurobiology, 1(3), 195-204." />
              <Reference text="Caldwell, J.A. et al. (2009). Fatigue countermeasures in aviation. Aviation, Space, and Environmental Medicine, 80(1), 29-59." />
              <Reference text="Dawson, D. & Reid, K. (1997). Fatigue, alcohol and performance impairment. Nature, 388, 235." />
              <Reference text="Folkard, S. & Åkerstedt, T. (1999). A three process model of the regulation of alertness-sleepiness. In: Sleep, Sleepiness and Performance." />
              <Reference text="ICAO (2016). Doc 9966: Manual for the Oversight of Fatigue Management Approaches (2nd ed.)." />
              <Reference text="Kamimori, G.H. et al. (2015). Caffeine improves reaction time, vigilance and logical reasoning. Aviation, Space, and Environmental Medicine, 86(8), 700-706." />
              <Reference text="Ker, K. et al. (2010). Caffeine for the prevention of injuries and errors in shift workers. Cochrane Database of Systematic Reviews, 5." />
              <Reference text="Kitamura, S. et al. (2016). Estimating individual optimal sleep duration and potential sleep debt. Scientific Reports, 6, 35812." />
              <Reference text="Nesthus, T.E. et al. (2007). Effects of mild hypoxia on pilot performances at general aviation altitudes. DOT/FAA/AM-07/6." />
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
    W: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
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
