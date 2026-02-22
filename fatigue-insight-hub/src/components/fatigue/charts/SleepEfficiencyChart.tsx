import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Moon } from 'lucide-react';

interface SleepEfficiencyChartProps {
  compact?: boolean;
}

export function SleepEfficiencyChart({ compact = false }: SleepEfficiencyChartProps) {
  const [sleepDuration, setSleepDuration] = useState(7);
  const [location, setLocation] = useState<'home' | 'hotel' | 'airport_hotel'>('home');
  const [sleepOnsetHour, setSleepOnsetHour] = useState(23);

  const LOCATION_EFFICIENCY = {
    home: 0.90,
    hotel: 0.85,
    crew_rest: 0.88,
    airport_hotel: 0.82,
    crew_house: 0.87,
  };

  const data = useMemo(() => {
    // Calculate each factor
    const baseEfficiency = LOCATION_EFFICIENCY[location];
    
    // WOCL overlap (sleep from onset to onset + duration)
    const sleepEnd = (sleepOnsetHour + sleepDuration) % 24;
    let woclOverlap = 0;
    for (let h = 0; h < sleepDuration; h++) {
      const hour = (sleepOnsetHour + h) % 24;
      if (hour >= 2 && hour < 6) woclOverlap++;
    }
    const woclPenalty = 1.0 - (woclOverlap * 0.05);
    
    // Late onset penalty
    let lateOnsetPenalty = 1.0;
    if (sleepOnsetHour >= 1 && sleepOnsetHour < 4) lateOnsetPenalty = 0.93;
    else if (sleepOnsetHour >= 0 && sleepOnsetHour < 1) lateOnsetPenalty = 0.97;
    
    // Duration penalty
    let durationPenalty = 1.0;
    if (sleepDuration < 4) durationPenalty = 0.75;
    else if (sleepDuration < 6) durationPenalty = 0.88;
    
    // Combined
    const combinedEfficiency = baseEfficiency * woclPenalty * lateOnsetPenalty * durationPenalty;
    const clampedEfficiency = Math.max(0.50, Math.min(1.0, combinedEfficiency));
    const effectiveSleep = sleepDuration * clampedEfficiency;

    return [
      { 
        factor: 'Location', 
        value: baseEfficiency, 
        impact: (baseEfficiency - 1) * 100,
        label: location.replace('_', ' '),
      },
      { 
        factor: 'WOCL', 
        value: woclPenalty, 
        impact: (woclPenalty - 1) * 100,
        label: `${woclOverlap}h overlap`,
      },
      { 
        factor: 'Onset', 
        value: lateOnsetPenalty, 
        impact: (lateOnsetPenalty - 1) * 100,
        label: `${sleepOnsetHour}:00 start`,
      },
      { 
        factor: 'Duration', 
        value: durationPenalty, 
        impact: (durationPenalty - 1) * 100,
        label: `${sleepDuration}h`,
      },
      { 
        factor: 'FINAL', 
        value: clampedEfficiency, 
        impact: 0,
        label: `${effectiveSleep.toFixed(1)}h effective`,
        isFinal: true,
      },
    ];
  }, [sleepDuration, location, sleepOnsetHour]);

  const getBarColor = (value: number, isFinal?: boolean) => {
    if (isFinal) return 'hsl(var(--primary))';
    if (value >= 1.0) return 'hsl(var(--success))';
    if (value >= 0.9) return 'hsl(var(--chart-4))';
    if (value >= 0.8) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
          <p className="font-medium">{d.factor}</p>
          <div className="mt-2 space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Multiplier:</span>
              <span className="font-mono">{d.value.toFixed(2)}</span>
            </p>
            {d.impact !== 0 && (
              <p className="flex justify-between gap-4">
                <span className="text-muted-foreground">Impact:</span>
                <span className={`font-mono ${d.impact < 0 ? 'text-destructive' : 'text-success'}`}>
                  {d.impact > 0 ? '+' : ''}{d.impact.toFixed(0)}%
                </span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{d.label}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const finalEfficiency = data.find(d => d.factor === 'FINAL')?.value || 0;
  const effectiveSleep = sleepDuration * finalEfficiency;

  return (
    <Card variant="glass">
      <CardHeader className={compact ? "pb-2" : ""}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Moon className="h-5 w-5 text-primary" />
          Sleep Quality Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label className="text-sm">Duration: {sleepDuration}h</Label>
              <Slider
                value={[sleepDuration]}
                onValueChange={(v) => setSleepDuration(v[0])}
                min={3}
                max={10}
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Location</Label>
              <Select value={location} onValueChange={(v: any) => setLocation(v)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="airport_hotel">Airport Hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sleep Onset: {sleepOnsetHour}:00</Label>
              <Slider
                value={[sleepOnsetHour]}
                onValueChange={(v) => setSleepOnsetHour(v[0])}
                min={20}
                max={27}
                step={1}
              />
            </div>
          </div>
        )}

        <div className={compact ? "h-48" : "h-56"}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis
                type="number"
                domain={[0.5, 1.05]}
                ticks={[0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="factor"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.value, (entry as any).isFinal)} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
          <div>
            <p className="text-sm text-muted-foreground">Final Result</p>
            <p className="text-lg font-semibold">
              {sleepDuration}h × {(finalEfficiency * 100).toFixed(0)}% = {effectiveSleep.toFixed(1)}h effective
            </p>
          </div>
          <Badge 
            variant="outline"
            className={
              effectiveSleep >= 7 ? 'border-success text-success' :
              effectiveSleep >= 6 ? 'border-warning text-warning' :
              'border-destructive text-destructive'
            }
          >
            {effectiveSleep >= 7 ? 'Adequate' : effectiveSleep >= 6 ? 'Marginal' : 'Insufficient'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
