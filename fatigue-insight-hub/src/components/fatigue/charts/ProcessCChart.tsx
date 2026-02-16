import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Clock } from 'lucide-react';

interface ProcessCChartProps {
  compact?: boolean;
}

export function ProcessCChart({ compact = false }: ProcessCChartProps) {
  const [phaseShift, setPhaseShift] = useState(0);

  // Model constants
  const MESOR = 0.5;
  const AMPLITUDE = 0.35;
  const ACROPHASE = 17; // Peak at 5 PM

  const data = useMemo(() => {
    const points: { hour: number; circadian: number; alertness: number; inWOCL: boolean }[] = [];
    
    for (let h = 0; h < 24; h++) {
      const effectiveHour = (h - phaseShift + 24) % 24;
      const angle = (2 * Math.PI * (effectiveHour - ACROPHASE)) / 24;
      const C = MESOR + AMPLITUDE * Math.cos(angle);
      
      // Normalize to 0-1 for display
      const normalizedC = (C - (MESOR - AMPLITUDE)) / (2 * AMPLITUDE);
      
      // WOCL: 02:00-06:00
      const inWOCL = h >= 2 && h < 6;

      points.push({
        hour: h,
        circadian: Math.round(C * 100) / 100,
        alertness: Math.round(normalizedC * 100),
        inWOCL,
      });
    }
    
    return points;
  }, [phaseShift]);

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
          <p className="font-medium">{formatHour(d.hour)}</p>
          <div className="mt-2 space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Circadian (C):</span>
              <span className="font-mono">{d.circadian.toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Alertness:</span>
              <span className="font-mono">{d.alertness}%</span>
            </p>
            {d.inWOCL && (
              <p className="text-destructive text-xs mt-1 font-medium">
                ⚠️ Window of Circadian Low
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
      <CardHeader className={compact ? "pb-2" : ""}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Process C: 24-Hour Circadian Rhythm
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <div className="max-w-xs mb-4">
            <Label className="text-sm">
              Phase Shift: {phaseShift > 0 ? '+' : ''}{phaseShift}h
              {phaseShift !== 0 && (
                <span className="text-muted-foreground ml-2">
                  (jet lag {phaseShift > 0 ? 'eastward' : 'westward'})
                </span>
              )}
            </Label>
            <Slider
              value={[phaseShift]}
              onValueChange={(v) => setPhaseShift(v[0])}
              min={-6}
              max={6}
              step={1}
              className="mt-2"
            />
          </div>
        )}

        <div className={compact ? "h-48" : "h-64"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              
              {/* WOCL Zone */}
              <ReferenceArea
                x1={2}
                x2={6}
                fill="hsl(var(--destructive))"
                fillOpacity={0.15}
                label={{ value: 'WOCL', position: 'insideTop', fill: 'hsl(var(--destructive))', fontSize: 10 }}
              />
              
              {/* Peak zone */}
              <ReferenceArea
                x1={15}
                x2={19}
                fill="hsl(var(--success))"
                fillOpacity={0.1}
              />
              
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                interval={compact ? 4 : 2}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                domain={[0.15, 0.85]}
                ticks={[0.2, 0.35, 0.5, 0.65, 0.8]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Midline */}
              <ReferenceLine y={0.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
              
              <Line
                type="monotone"
                dataKey="circadian"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-2))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-6 rounded" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
              <span>Circadian Alertness (C)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-6 rounded bg-destructive/20" />
              <span>WOCL (02:00-06:00)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-6 rounded bg-success/20" />
              <span>Peak Alertness Zone</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
