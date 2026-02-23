import { GitCompareArrows, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface WhatIfEmptyComparisonProps {
  hasModifications: boolean;
}

export function WhatIfEmptyComparison({ hasModifications }: WhatIfEmptyComparisonProps) {
  return (
    <Card variant="glass" className="p-8 md:p-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <GitCompareArrows className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {hasModifications ? 'Ready to Compare' : 'Modify Duties to Begin'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {hasModifications ? (
          <>
            Click <strong>Run Scenario</strong> to see how your modifications
            affect fatigue predictions compared to the original analysis.
          </>
        ) : (
          <>
            Use the editor on the left to adjust duty times, change crew
            composition, or exclude duties. Then run the scenario to see the
            impact on fatigue predictions.
          </>
        )}
      </p>
      {!hasModifications && (
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground/60">
          <span>Shift times</span>
          <ArrowRight className="h-3 w-3" />
          <span>Change crew</span>
          <ArrowRight className="h-3 w-3" />
          <span>Exclude duties</span>
          <ArrowRight className="h-3 w-3" />
          <span>Compare results</span>
        </div>
      )}
    </Card>
  );
}
