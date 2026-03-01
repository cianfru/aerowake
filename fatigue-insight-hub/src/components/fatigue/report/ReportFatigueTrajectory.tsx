import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ReportData } from '@/lib/report-narrative';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from 'recharts';

interface Props {
  data: ReportData;
}

export function ReportFatigueTrajectory({ data }: Props) {
  const { trajectoryNarrative, timeline, thresholdCrossings } = data;

  // Transform timeline into chart-friendly format
  const chartData = useMemo(() => {
    return timeline.map(pt => ({
      hoursOnDuty: Number(pt.hours_on_duty.toFixed(2)),
      performance: pt.performance ?? null,
      sleepPressure: (pt.sleep_pressure ?? 0) * 100,
      circadian: (pt.circadian ?? 0) * 100,
      sleepInertia: pt.sleep_inertia != null ? (1 - pt.sleep_inertia) * 100 : 0,
      timeOnTask: pt.time_on_task_penalty != null ? (1 - pt.time_on_task_penalty) * 100 : 0,
      isRest: pt.is_in_rest,
      phase: pt.flight_phase,
      timestamp: pt.timestamp_local
        ? new Date(pt.timestamp_local).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : undefined,
    }));
  }, [timeline]);

  if (chartData.length < 2) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
          4. Fatigue Trajectory
        </h2>
        <Card variant="glass" className="print:bg-white print:border-gray-300">
          <CardContent className="py-4 px-5">
            <p className="text-sm text-muted-foreground">
              Detailed timeline data is not available for this duty. The trajectory cannot be visualized.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 print:text-black">
        4. Fatigue Trajectory
      </h2>
      <Card variant="glass" className="print:bg-white print:border-gray-300">
        <CardContent className="py-4 px-5 space-y-4">
          {/* Narrative */}
          <p className="text-sm leading-relaxed print:text-black">
            {trajectoryNarrative}
          </p>

          {/* Performance chart */}
          <div className="h-[240px] print:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="hoursOnDuty"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Hours on Duty', position: 'bottom', fontSize: 10, offset: -2 }}
                  tickFormatter={(v) => `${v}h`}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Performance %', angle: -90, position: 'insideLeft', fontSize: 10, offset: 10 }}
                />

                {/* Risk thresholds */}
                <ReferenceLine y={77} stroke="hsl(var(--warning))" strokeDasharray="6 3" strokeOpacity={0.6} />
                <ReferenceLine y={55} stroke="hsl(var(--critical))" strokeDasharray="6 3" strokeOpacity={0.6} />

                {/* Performance area */}
                <defs>
                  <linearGradient id="reportPerfGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="performance"
                  fill="url(#reportPerfGradient)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium">
                          {d.timestamp ?? `${d.hoursOnDuty}h on duty`}
                          {d.phase && <span className="text-muted-foreground ml-2">{d.phase}</span>}
                        </p>
                        <p className="font-mono mt-1">
                          Performance: <span className="font-bold">{d.performance?.toFixed(1)}%</span>
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          S: {d.sleepPressure.toFixed(0)}% · C: {d.circadian.toFixed(0)}%
                        </p>
                      </div>
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart legend */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground print:text-gray-600 justify-center">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[hsl(var(--primary))]" />
              Performance
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 border-t border-dashed border-[hsl(var(--warning))]" />
              77% Threshold
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 border-t border-dashed border-[hsl(var(--critical))]" />
              55% Threshold
            </span>
          </div>

          {/* Threshold crossings callout */}
          {thresholdCrossings.length > 0 && (
            <div className="border-t border-border/30 pt-3 space-y-1.5">
              <h4 className="text-xs font-medium text-muted-foreground print:text-gray-600">
                Threshold Crossings
              </h4>
              {thresholdCrossings.map((crossing, i) => (
                <p key={i} className="text-xs print:text-black">
                  <span className="font-medium">{crossing.thresholdLabel}</span> ({crossing.threshold}%) crossed at{' '}
                  <span className="font-mono">
                    {crossing.timestamp
                      ? new Date(crossing.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                      : `${crossing.crossedAt.toFixed(1)}h on duty`}
                  </span>
                  {' '}— performance: {crossing.performance.toFixed(0)}%
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
