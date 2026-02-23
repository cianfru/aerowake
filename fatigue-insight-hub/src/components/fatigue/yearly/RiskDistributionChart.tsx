import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import type { MonthlyMetrics } from '@/lib/api-client';

interface RiskDistributionChartProps {
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
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-medium mb-1.5">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}: </span>
            <span className="font-mono font-medium">{entry.value}</span>
          </p>
        ))}
        <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/30">
          Total: <span className="font-mono font-medium">{total}</span> duties
        </p>
      </div>
    );
  }
  return null;
}

export function RiskDistributionChart({ months }: RiskDistributionChartProps) {
  const data = months.map((m) => ({
    month: formatMonth(m.month),
    Low: m.low_risk_count,
    Moderate: m.moderate_risk_count,
    High: m.high_risk_count,
    Critical: m.critical_risk_count,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Risk Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
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
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Bar dataKey="Low" stackId="risk" fill="hsl(var(--success))" />
            <Bar dataKey="Moderate" stackId="risk" fill="hsl(var(--warning))" />
            <Bar dataKey="High" stackId="risk" fill="hsl(var(--high))" />
            <Bar dataKey="Critical" stackId="risk" fill="hsl(var(--critical))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
