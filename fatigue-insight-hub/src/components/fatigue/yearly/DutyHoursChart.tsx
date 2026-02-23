import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { MonthlyMetrics } from '@/lib/api-client';

interface DutyHoursChartProps {
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
            <span className="font-mono font-medium">{entry.value.toFixed(1)}h</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function DutyHoursChart({ months }: DutyHoursChartProps) {
  const data = months.map((m) => ({
    month: formatMonth(m.month),
    'Duty Hours': m.total_duty_hours,
    'Block Hours': m.total_block_hours,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          Monthly Duty & Block Hours
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
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Bar dataKey="Duty Hours" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Block Hours" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
