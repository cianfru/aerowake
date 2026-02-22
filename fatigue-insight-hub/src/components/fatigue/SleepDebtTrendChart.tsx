import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DutyAnalysis } from '@/types/fatigue';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { Battery, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SleepDebtTrendChartProps {
  duties: DutyAnalysis[];
  month: Date;
}

export function SleepDebtTrendChart({ duties, month }: SleepDebtTrendChartProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Build cumulative sleep debt data
  let cumulativeDebt = 0;
  const decayRate = 0.15; // Debt reduction per rest day

  const chartData = allDays.map((day) => {
    const duty = duties.find(d => isSameDay(d.date, day));
    
    if (duty) {
      // Add daily debt from duty
      cumulativeDebt += duty.sleepDebt;
    } else {
      // Decay on rest days
      cumulativeDebt = Math.max(0, cumulativeDebt * (1 - decayRate));
    }

    const riskLevel = cumulativeDebt > 10 ? 'critical' : 
                      cumulativeDebt > 6 ? 'high' : 
                      cumulativeDebt > 3 ? 'moderate' : 'low';

    return {
      date: format(day, 'dd'),
      fullDate: format(day, 'MMM dd'),
      sleepDebt: Math.round(cumulativeDebt * 10) / 10,
      dailyDebt: duty?.sleepDebt || 0,
      isDuty: !!duty,
      riskLevel,
    };
  });

  const maxDebt = Math.max(...chartData.map(d => d.sleepDebt), 10);
  const currentDebt = chartData[chartData.length - 1]?.sleepDebt || 0;
  const peakDebt = Math.max(...chartData.map(d => d.sleepDebt));
  const trend = chartData.length > 7 
    ? chartData[chartData.length - 1].sleepDebt - chartData[chartData.length - 7].sleepDebt
    : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{data.fullDate}</p>
          <p className="text-xs text-muted-foreground mb-2">
            {data.isDuty ? '✈️ Flight Duty' : '🛏️ Rest Day (Recovery)'}
          </p>
          <div className="space-y-1">
            <p className="text-xs">
              <span className="text-muted-foreground">Cumulative Debt: </span>
              <span className={`font-medium ${
                data.sleepDebt > 6 ? 'text-critical' : 
                data.sleepDebt > 3 ? 'text-warning' : 'text-success'
              }`}>
                {data.sleepDebt.toFixed(1)}h
              </span>
            </p>
            {data.isDuty && data.dailyDebt > 0 && (
              <p className="text-xs">
                <span className="text-muted-foreground">Added Today: </span>
                <span className="text-critical">+{data.dailyDebt.toFixed(1)}h</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Battery className="h-5 w-5 text-primary" />
            Sleep Debt Trend
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              {trend > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-critical" />
                  <span className="text-critical">+{trend.toFixed(1)}h</span>
                </>
              ) : trend < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-success" />
                  <span className="text-success">{trend.toFixed(1)}h</span>
                </>
              ) : (
                <span className="text-muted-foreground">Stable</span>
              )}
              <span className="text-muted-foreground">7d</span>
            </div>
            <Badge variant={currentDebt > 6 ? 'critical' : currentDebt > 3 ? 'warning' : 'success'}>
              {currentDebt.toFixed(1)}h debt
            </Badge>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cumulative sleep debt builds with each duty and recovers during rest periods
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--critical))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis
                domain={[0, maxDebt]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={6}
                stroke="hsl(var(--warning))"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: 'High Risk', position: 'right', fontSize: 9, fill: 'hsl(var(--warning))' }}
              />
              <ReferenceLine
                y={10}
                stroke="hsl(var(--critical))"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: 'Critical', position: 'right', fontSize: 9, fill: 'hsl(var(--critical))' }}
              />
              <Area
                type="monotone"
                dataKey="sleepDebt"
                stroke="hsl(var(--warning))"
                fillOpacity={1}
                fill="url(#colorDebt)"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isDuty) {
                    const color = payload.sleepDebt > 6 ? 'hsl(var(--critical))' : 
                                  payload.sleepDebt > 3 ? 'hsl(var(--warning))' : 
                                  'hsl(var(--success))';
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={color}
                        stroke="hsl(var(--background))"
                        strokeWidth={1}
                      />
                    );
                  }
                  return <circle cx={cx} cy={cy} r={0} />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-xs">
          <div className="rounded-lg bg-secondary/30 p-2">
            <p className="text-muted-foreground">Peak Debt</p>
            <p className={`font-bold ${peakDebt > 6 ? 'text-critical' : 'text-warning'}`}>
              {peakDebt.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-2">
            <p className="text-muted-foreground">Current</p>
            <p className={`font-bold ${currentDebt > 6 ? 'text-critical' : 'text-success'}`}>
              {currentDebt.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-2">
            <p className="text-muted-foreground">Recovery Rate</p>
            <p className="font-bold text-success">~{(decayRate * 100).toFixed(0)}%/day</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
