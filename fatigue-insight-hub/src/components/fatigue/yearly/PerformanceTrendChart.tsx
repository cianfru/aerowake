import { format, parseISO } from 'date-fns';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import type { MonthlyMetrics } from '@/lib/api-client';

interface PerformanceTrendChartProps {
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
              {entry.value.toFixed(1)}%
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function PerformanceTrendChart({ months }: PerformanceTrendChartProps) {
  const data = months.map((m) => ({
    month: formatMonth(m.month),
    'Avg Performance': m.avg_performance,
    'Worst Performance': m.worst_performance,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-primary" />
          Performance Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[40, 100]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={77}
              stroke="hsl(var(--warning))"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{ value: '77%', position: 'right', fontSize: 9, fill: 'hsl(var(--warning))' }}
            />
            <ReferenceLine
              y={55}
              stroke="hsl(var(--critical))"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
              label={{ value: '55%', position: 'right', fontSize: 9, fill: 'hsl(var(--critical))' }}
            />
            <Line
              type="monotone"
              dataKey="Avg Performance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Worst Performance"
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
