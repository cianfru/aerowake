import type { DutyAnalysis } from '@/types/fatigue';
import type { ReportData } from '@/lib/report-narrative';
export function ReportRiskAssessment({ duty }: { data: ReportData; duty: DutyAnalysis }) {
  return <section className="space-y-3">
    <h2 className="text-sm font-semibold">Interpretation and uncertainty</h2>
    <p className="text-sm">Sleep duration and quality are estimated unless confirmed by the pilot. Derived sleepiness and vigilance scales are experimental transformations, not independent measurements. BAM equivalence has not been established.</p>
    <p className="text-sm">Classification uses {duty.riskThresholds ? 'the thresholds saved with this calculation' : 'legacy thresholds; recalculate for traceability'}. A model score alone does not establish fitness for duty or regulatory compliance.</p>
  </section>;
}
