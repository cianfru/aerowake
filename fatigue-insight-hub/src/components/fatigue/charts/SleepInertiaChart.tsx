import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Zap } from 'lucide-react';

interface SleepInertiaChartProps {
  compact?: boolean;
}

export function SleepInertiaChart({ compact = false }: SleepInertiaChartProps) {
  // Model constants
  const W_MAX = 0.30;
  const TAU_W = 30; // minutes

  const data = useMemo(() => {
    const points: { minute: number; inertia: number; performanceImpact: number }[] = [];
    
    for (let m = 0; m <= 60; m++) {
      const W = W_MAX * Math.exp(-m / (TAU_W / 3));
      
      points.push({
        minute: m,
        inertia: Math.round(W * 100) / 100,
        performanceImpact: Math.round(W * 100),
      });
    }
    
    return points;
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
          <p className="font-medium">{d.minute} minutes after waking</p>
          <div className="mt-2 space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Inertia (W):</span>
              <span className="font-mono">{d.inertia.toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Performance Impact:</span>
              <span className="font-mono text-destructive">-{d.performanceImpact}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="glass">
      <CardHeader className={compact ? "pb-2" : ""}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          Process W: Sleep Inertia Dissipation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={compact ? "h-48" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="inertiaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="minute"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(m) => `${m}m`}
                interval={compact ? 15 : 10}
              />
              <YAxis
                domain={[0, 0.35]}
                ticks={[0, 0.1, 0.2, 0.3]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={40}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Threshold lines */}
              <ReferenceLine x={10} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeOpacity={0.6} />
              <ReferenceLine x={20} stroke="hsl(var(--warning))" strokeDasharray="5 5" strokeOpacity={0.6} />
              <ReferenceLine x={30} stroke="hsl(var(--success))" strokeDasharray="5 5" strokeOpacity={0.6} />
              
              <Area
                type="monotone"
                dataKey="inertia"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                fill="url(#inertiaGradient)"
                activeDot={{ r: 4, fill: 'hsl(var(--warning))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {!compact && (
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="font-medium text-destructive">10 min</p>
              <p className="text-muted-foreground">~21% impact</p>
            </div>
            <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
              <p className="font-medium text-warning">20 min</p>
              <p className="text-muted-foreground">~12% impact</p>
            </div>
            <div className="p-2 rounded-lg bg-success/10 border border-success/20">
              <p className="font-medium text-success">30 min</p>
              <p className="text-muted-foreground">~4% impact</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
