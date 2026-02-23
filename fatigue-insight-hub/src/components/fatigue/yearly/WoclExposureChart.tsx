import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EyeOff } from 'lucide-react';
import type { MonthlyMetrics } from '@/lib/api-client';

interface WoclExposureChartProps {
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
        <p className="text-xs">
          <span className="text-muted-foreground">WOCL Exposure: </span>
          <span className="font-mono font-medium text-[hsl(var(--wocl,280_60%_70%))]">
            {payload[0].value.toFixed(1)}h
          </span>
        </p>
      </div>
    );
  }
  return null;
}

export function WoclExposureChart({ months }: WoclExposureChartProps) {
  const data = months.map((m) => ({
    month: formatMonth(m.month),
    'WOCL Hours': m.total_wocl_hours,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <EyeOff className="h-4 w-4 text-primary" />
          WOCL Exposure
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (Window of Circadian Low — 02:00–05:59)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="WOCL Hours"
              fill="hsl(280 60% 70%)"
              radius={[3, 3, 0, 0]}
              opacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
