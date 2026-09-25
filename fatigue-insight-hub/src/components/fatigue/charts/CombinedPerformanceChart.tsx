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
import { simulateRestedDay } from '@/lib/fatigue-calculations';
import {
  INDEX_AXIS_TICKS,
  INDEX_DOMAIN,
  RISK_LEVEL_KSS_RANGE,
  classifyPerformance,
  indexTickAsKss,
  normalizeRiskLevel,
  riskCssColor,
  riskReferenceLines,
  toUpperRisk,
} from '@/lib/risk-scale';

interface CombinedPerformanceChartProps {
  compact?: boolean;
}

export function CombinedPerformanceChart({ compact = false }: CombinedPerformanceChartProps) {
  const [wakeHour, setWakeHour] = useState(7);
  const [reportHour, setReportHour] = useState(14);

  const data = useMemo(() => {
    const points: {
      hour: number;
      hoursAwake: number;
      processS: number;
      processC: number;
      kss: number;
      performance: number;
      riskLevel: string;
      inWOCL: boolean;
    }[] = [];
    

    // Generate 20 hours from wake time (Three Process Model, Ingre et al. 2014)
    for (const p of simulateRestedDay(wakeHour, 20)) {
      points.push({
        hour: p.hoursAwake,
        hoursAwake: p.hoursAwake,
        processS: Math.round(p.s * 100) / 100,
        processC: Math.round(p.c * 100) / 100,
        kss: Math.round(p.kss * 10) / 10,
        performance: Math.round(p.index),
        riskLevel: toUpperRisk(classifyPerformance(p.index)),
        inWOCL: p.clockHour >= 2 && p.clockHour < 6,
      });
    }
    
    return points;
  }, [wakeHour]);

  const formatHour = (h: number) => {
    const actualHour = (wakeHour + h) % 24;
    return `${actualHour.toString().padStart(2, '0')}:00`;
  };

  const getRiskColor = (level: string) => riskCssColor(normalizeRiskLevel(level));

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
              <span className="text-muted-foreground">Predicted KSS:</span>
              <span className="font-mono font-bold" style={{ color: getRiskColor(d.riskLevel) }}>
                {d.kss.toFixed(1)} (index {d.performance})
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
          Three Process Model (KSS)
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
              {riskReferenceLines().map((line) => (
                <ReferenceLine
                  key={line.value}
                  y={line.value}
                  stroke={line.color}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                  label={{ value: line.label, position: 'right', fontSize: 9, fill: line.color }}
                />
              ))}
              
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                interval={compact ? 4 : 2}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                domain={INDEX_DOMAIN}
                ticks={INDEX_AXIS_TICKS}
                tickFormatter={(v: number) => `KSS ${indexTickAsKss(v)}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                width={45}
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
            {(['low', 'moderate', 'high', 'critical', 'extreme'] as const).map((level) => (
              <Badge key={level} variant="outline" style={{ borderColor: riskCssColor(level), color: riskCssColor(level) }}>
                {RISK_LEVEL_KSS_RANGE[level]} {level.toUpperCase()}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
