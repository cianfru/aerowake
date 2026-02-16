import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Calculator } from 'lucide-react';

interface CombinedPerformanceChartProps {
  compact?: boolean;
}

export function CombinedPerformanceChart({ compact = false }: CombinedPerformanceChartProps) {
  const [wakeHour, setWakeHour] = useState(7);
  const [reportHour, setReportHour] = useState(14);

  // Model constants
  const S_MAX = 0.95;
  const TAU_INCREASE = 18.2;
  const MESOR = 0.5;
  const AMPLITUDE = 0.35;
  const ACROPHASE = 17;
  const FLOOR = 20;

  const data = useMemo(() => {
    const points: {
      hour: number;
      hoursAwake: number;
      processS: number;
      processC: number;
      performance: number;
      riskLevel: string;
      inWOCL: boolean;
    }[] = [];
    
    const S0 = 0.15; // Sleep pressure at wake
    
    // Generate 20 hours from wake time
    for (let h = 0; h <= 20; h++) {
      const actualHour = (wakeHour + h) % 24;
      
      // Process S
      const S = S_MAX - (S_MAX - S0) * Math.exp(-h / TAU_INCREASE);
      const S_alert = 1 - S;
      
      // Process C
      const angle = (2 * Math.PI * (actualHour - ACROPHASE)) / 24;
      const C = MESOR + AMPLITUDE * Math.cos(angle);
      const C_alert = (C - (MESOR - AMPLITUDE)) / (2 * AMPLITUDE);
      
      // Combined performance
      const baseAlert = S_alert * 0.6 + C_alert * 0.4;
      const performance = FLOOR + baseAlert * (100 - FLOOR);
      
      // Risk level
      let riskLevel = 'LOW';
      if (performance < 55) riskLevel = 'CRITICAL';
      else if (performance < 65) riskLevel = 'HIGH';
      else if (performance < 75) riskLevel = 'MODERATE';
      
      // WOCL
      const inWOCL = actualHour >= 2 && actualHour < 6;

      points.push({
        hour: h,
        hoursAwake: h,
        processS: Math.round(S * 100) / 100,
        processC: Math.round(C * 100) / 100,
        performance: Math.round(performance),
        riskLevel,
        inWOCL,
      });
    }
    
    return points;
  }, [wakeHour]);

  const formatHour = (h: number) => {
    const actualHour = (wakeHour + h) % 24;
    return `${actualHour.toString().padStart(2, '0')}:00`;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'hsl(var(--destructive))';
      case 'HIGH': return 'hsl(var(--warning))';
      case 'MODERATE': return 'hsl(var(--chart-4))';
      default: return 'hsl(var(--success))';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg text-sm">
          <p className="font-medium">{formatHour(d.hour)} ({d.hoursAwake}h awake)</p>
          <div className="mt-2 space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Process S:</span>
              <span className="font-mono">{d.processS.toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Process C:</span>
              <span className="font-mono">{d.processC.toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Performance:</span>
              <span className="font-mono font-bold" style={{ color: getRiskColor(d.riskLevel) }}>
                {d.performance}%
              </span>
            </p>
            <Badge 
              variant="outline" 
              className="mt-1"
              style={{ borderColor: getRiskColor(d.riskLevel), color: getRiskColor(d.riskLevel) }}
            >
              {d.riskLevel} RISK
            </Badge>
            {d.inWOCL && (
              <p className="text-destructive text-xs mt-1">⚠️ WOCL Period</p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Find WOCL indices for shading
  const woclIndices = data.map((d, i) => d.inWOCL ? i : -1).filter(i => i >= 0);
  const woclStart = woclIndices.length > 0 ? woclIndices[0] : -1;
  const woclEnd = woclIndices.length > 0 ? woclIndices[woclIndices.length - 1] : -1;

  return (
    <Card variant="glass">
      <CardHeader className={compact ? "pb-2" : ""}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" />
          Combined Performance Model
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <div className="max-w-xs mb-4">
            <Label className="text-sm">Wake Time: {wakeHour.toString().padStart(2, '0')}:00</Label>
            <Slider
              value={[wakeHour]}
              onValueChange={(v) => setWakeHour(v[0])}
              min={4}
              max={12}
              step={1}
              className="mt-2"
            />
          </div>
        )}

        <div className={compact ? "h-52" : "h-72"}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              
              {/* WOCL Zone */}
              {woclStart >= 0 && woclEnd >= 0 && (
                <ReferenceArea
                  x1={woclStart}
                  x2={woclEnd}
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.1}
                />
              )}
              
              {/* Risk thresholds */}
              <ReferenceLine y={55} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeOpacity={0.6} />
              <ReferenceLine y={65} stroke="hsl(var(--warning))" strokeDasharray="5 5" strokeOpacity={0.6} />
              <ReferenceLine y={75} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" strokeOpacity={0.6} />
              
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                interval={compact ? 4 : 2}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                domain={[20, 100]}
                ticks={[20, 40, 55, 65, 75, 90, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              
              <Area
                type="monotone"
                dataKey="performance"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#performanceGradient)"
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-success text-success">≥75 LOW</Badge>
            <Badge variant="outline" className="border-chart-4 text-chart-4">65-74 MODERATE</Badge>
            <Badge variant="outline" className="border-warning text-warning">55-64 HIGH</Badge>
            <Badge variant="outline" className="border-destructive text-destructive">&lt;55 CRITICAL</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
