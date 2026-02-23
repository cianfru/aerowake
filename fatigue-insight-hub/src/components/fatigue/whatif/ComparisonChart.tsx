import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnalysisResults } from '@/types/fatigue';

interface ComparisonChartProps {
  original: AnalysisResults;
  whatIf: AnalysisResults;
}

interface ChartPoint {
  label: string;
  date: string;
  originalPerf: number | null;
  whatIfPerf: number | null;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const origVal = payload.find((p: any) => p.dataKey === 'originalPerf')?.value;
  const whatIfVal = payload.find((p: any) => p.dataKey === 'whatIfPerf')?.value;

  const delta = origVal != null && whatIfVal != null ? whatIfVal - origVal : null;
  const deltaColor = delta != null ? (delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground') : '';

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
      <p className="text-xs font-medium mb-1.5">{label}</p>
      <div className="space-y-1">
        {origVal != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Original</span>
            <span className="text-xs font-mono">{origVal.toFixed(1)}%</span>
          </div>
        )}
        {whatIfVal != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">What-If</span>
            <span className="text-xs font-mono">{whatIfVal.toFixed(1)}%</span>
          </div>
        )}
        {delta != null && (
          <div className={`flex items-center justify-between gap-4 pt-1 border-t border-border/30 ${deltaColor}`}>
            <span className="text-xs">Delta</span>
            <span className="text-xs font-mono font-semibold">
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ComparisonChart({ original, whatIf }: ComparisonChartProps) {
  const chartData = useMemo(() => {
    // Build lookup for what-if duties by dutyId
    const whatIfMap = new Map(
      whatIf.duties.map((d) => [d.dutyId, d]),
    );

    const points: ChartPoint[] = original.duties
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((duty) => {
        const dateStr = duty.dateString || new Date(duty.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const whatIfDuty = whatIfMap.get(duty.dutyId);

        return {
          label: `${dateStr}`,
          date: dateStr,
          originalPerf: duty.minPerformance,
          whatIfPerf: whatIfDuty?.minPerformance ?? null,
        };
      });

    // Also add any what-if duties that aren't in original (shouldn't happen, but safety)
    return points;
  }, [original.duties, whatIf.duties]);

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Performance Comparison</CardTitle>
        <p className="text-xs text-muted-foreground">
          Minimum performance per duty — original vs scenario
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Threshold reference lines */}
            <ReferenceLine
              y={77}
              stroke="hsl(var(--warning))"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
            <ReferenceLine
              y={55}
              stroke="hsl(var(--critical))"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />

            {/* Original line (solid) */}
            <Line
              type="monotone"
              dataKey="originalPerf"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              name="Original"
              connectNulls
            />

            {/* What-if line (dashed) */}
            <Line
              type="monotone"
              dataKey="whatIfPerf"
              stroke="hsl(var(--chart-4, 280 60% 70%))"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: 'hsl(var(--chart-4, 280 60% 70%))' }}
              name="What-If"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 bg-primary rounded-full" />
            <span className="text-[10px] text-muted-foreground">Original</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 rounded-full" style={{ background: 'hsl(280 60% 70%)', backgroundImage: 'repeating-linear-gradient(90deg, hsl(280 60% 70%) 0 4px, transparent 4px 6px)' }} />
            <span className="text-[10px] text-muted-foreground">What-If</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
