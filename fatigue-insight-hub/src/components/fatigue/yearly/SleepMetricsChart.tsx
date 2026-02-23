import { format, parseISO } from 'date-fns';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Moon } from 'lucide-react';
import type { MonthlyMetrics } from '@/lib/api-client';

interface SleepMetricsChartProps {
  months: MonthlyMetrics[];
}

function formatMonth(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMM yy');
  } catch {
    return month;
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-medium mb-1.5">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs">
            <span className="text-muted-foreground">{entry.name}: </span>
            <span className="font-mono font-medium" style={{ color: entry.color }}>
              {entry.value.toFixed(1)}h
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function SleepMetricsChart({ months }: SleepMetricsChartProps) {
  const data = months.map((m) => ({
    month: formatMonth(m.month),
    'Avg Sleep': m.avg_sleep_per_night,
    'Max Sleep Debt': m.max_sleep_debt,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Moon className="h-4 w-4 text-primary" />
          Sleep Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="sleep"
              orientation="left"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              domain={[0, 'auto']}
            />
            <YAxis
              yAxisId="debt"
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              yAxisId="sleep"
              y={8}
              stroke="hsl(var(--success))"
              strokeDasharray="5 5"
              strokeOpacity={0.4}
              label={{ value: '8h', position: 'left', fontSize: 9, fill: 'hsl(var(--success))' }}
            />
            <Area
              yAxisId="sleep"
              type="monotone"
              dataKey="Avg Sleep"
              stroke="hsl(var(--success))"
              fill="url(#sleepGradient)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--success))' }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="debt"
              type="monotone"
              dataKey="Max Sleep Debt"
              stroke="hsl(var(--critical))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: 'hsl(var(--critical))' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
