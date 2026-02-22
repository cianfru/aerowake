import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Brain } from 'lucide-react';

interface ProcessSChartProps {
  compact?: boolean;
}

export function ProcessSChart({ compact = false }: ProcessSChartProps) {
  const [wakeHour, setWakeHour] = useState(7);
  const [sleepPressureAtWake, setSleepPressureAtWake] = useState(0.15);
  const [sleepHour, setSleepHour] = useState(23);

  // Model constants
  const S_MAX = 0.95;
  const S_MIN = 0.0;
  const TAU_INCREASE = 18.2;
  const TAU_DECREASE = 4.2;

  const data = useMemo(() => {
    const points: { hour: number; sleepPressure: number; alertness: number; phase: string }[] = [];
    
    // Generate 36 hours of data (covers wake + sleep cycle)
    for (let h = 0; h <= 36; h++) {
      const actualHour = (wakeHour + h) % 24;
      let S: number;
      let phase: string;

      // Determine if awake or asleep
      const hoursFromWake = h;
      const sleepStartOffset = (sleepHour - wakeHour + 24) % 24;
      const isAsleep = hoursFromWake >= sleepStartOffset && hoursFromWake < sleepStartOffset + 8;

      if (isAsleep) {
        // During sleep - exponential decay
        const hoursSleeping = hoursFromWake - sleepStartOffset;
        const S_atSleepStart = S_MAX - (S_MAX - sleepPressureAtWake) * Math.exp(-sleepStartOffset / TAU_INCREASE);
        S = S_MIN + (S_atSleepStart - S_MIN) * Math.exp(-hoursSleeping / TAU_DECREASE);
        phase = 'sleep';
      } else if (hoursFromWake < sleepStartOffset) {
        // During wakefulness before sleep
        S = S_MAX - (S_MAX - sleepPressureAtWake) * Math.exp(-hoursFromWake / TAU_INCREASE);
        phase = 'awake';
      } else {
        // After waking from sleep
        const newWakeOffset = sleepStartOffset + 8;
        const hoursAwakeSinceNewWake = hoursFromWake - newWakeOffset;
        const S_atNewWake = 0.15; // Typical value after good sleep
        S = S_MAX - (S_MAX - S_atNewWake) * Math.exp(-hoursAwakeSinceNewWake / TAU_INCREASE);
        phase = 'awake';
      }

      if (h <= 30) {
        points.push({
          hour: h,
          sleepPressure: Math.round(S * 100) / 100,
          alertness: Math.round((1 - S) * 100),
          phase,
        });
      }
    }
    
    return points;
  }, [wakeHour, sleepPressureAtWake, sleepHour]);

  const formatHour = (h: number) => {
    const actualHour = (wakeHour + h) % 24;
    return `${actualHour.toString().padStart(2, '0')}:00`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
          <p className="font-medium">{formatHour(d.hour)}</p>
          <div className="mt-2 space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sleep Pressure:</span>
              <span className="font-mono">{d.sleepPressure.toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Alertness:</span>
              <span className="font-mono">{d.alertness}%</span>
            </p>
            <Badge variant={d.phase === 'sleep' ? 'secondary' : 'outline'} className="mt-1">
              {d.phase === 'sleep' ? '😴 Sleeping' : '☀️ Awake'}
            </Badge>
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
          <Brain className="h-5 w-5 text-primary" />
          Process S: Sleep Pressure Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <div className="grid gap-6 sm:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label className="text-sm">Wake Time: {wakeHour.toString().padStart(2, '0')}:00</Label>
              <Slider
                value={[wakeHour]}
                onValueChange={(v) => setWakeHour(v[0])}
                min={4}
                max={10}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sleep Pressure at Wake: {sleepPressureAtWake.toFixed(2)}</Label>
              <Slider
                value={[sleepPressureAtWake * 100]}
                onValueChange={(v) => setSleepPressureAtWake(v[0] / 100)}
                min={5}
                max={40}
                step={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Bedtime: {sleepHour.toString().padStart(2, '0')}:00</Label>
              <Slider
                value={[sleepHour]}
                onValueChange={(v) => setSleepHour(v[0])}
                min={20}
                max={26}
                step={1}
              />
            </div>
          </div>
        )}

        <div className={compact ? "h-48" : "h-64"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                interval={compact ? 5 : 3}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Sleep zone highlight */}
              {data.filter(d => d.phase === 'sleep').length > 0 && (() => {
                const sleepIndices = data.map((d, i) => d.phase === 'sleep' ? i : -1).filter(i => i >= 0);
                return sleepIndices.length > 0 ? (
                  <ReferenceArea
                    x1={sleepIndices[0]}
                    x2={sleepIndices[sleepIndices.length - 1]}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                ) : null;
              })()}
              
              {/* Thresholds */}
              <ReferenceLine y={0.75} stroke="hsl(var(--warning))" strokeDasharray="5 5" />
              <ReferenceLine y={0.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
              
              <Line
                type="monotone"
                dataKey="sleepPressure"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-6 rounded bg-primary" />
              <span>Sleep Pressure (S)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-px w-6 border-t-2 border-dashed border-warning" />
              <span>High Fatigue Threshold (0.75)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-6 rounded bg-primary/10" />
              <span>Sleep Period</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
