import { useState } from 'react';
import {
  Users, LogIn, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Activity, Moon, Timer, ShieldAlert, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useComparativeMetrics } from '@/hooks/useComparativeMetrics';
import { useRosterHistory } from '@/hooks/useRosterHistory';
import { cn } from '@/lib/utils';
import type { GroupMetrics, PercentilePosition } from '@/lib/api-client';

// ── Helpers ──────────────────────────────────────────────────

function formatMonth(month: string): string {
  try {
    const [year, m] = month.split('-');
    return format(new Date(Number(year), Number(m) - 1), 'MMM yyyy');
  } catch {
    return month;
  }
}

function formatShortMonth(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMM yy');
  } catch {
    return month;
  }
}

function groupLabel(type: string, value: string): string {
  if (type === 'company') return 'Company';
  if (type === 'fleet') return value;
  if (type === 'role') return value === 'captain' ? 'Captains' : 'First Officers';
  if (type === 'fleet_role') {
    const [fleet, role] = value.split('_');
    return `${fleet} ${role === 'captain' ? 'CP' : 'FO'}`;
  }
  return value;
}

function percentileColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground';
  if (pct >= 65) return 'text-emerald-500';
  if (pct >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function percentileBg(pct: number | null): string {
  if (pct === null) return 'bg-muted/30';
  if (pct >= 65) return 'bg-emerald-500/10';
  if (pct >= 40) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// ── Main Page ────────────────────────────────────────────────

export function ComparativeMetricsPage() {
  const { isAuthenticated, user } = useAuth();
  const { setActiveTab } = useAnalysis();
  const { rosters } = useRosterHistory();
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);

  const { metrics, trend, isLoading, isError, hasCompany } = useComparativeMetrics(selectedMonth);

  // Available months from roster history
  const availableMonths = [...new Set(rosters.map(r => r.month))].sort().reverse();

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to compare your fatigue metrics with your fleet peers.
            </p>
            <a href="/login">
              <Button variant="glow" size="sm">Sign In</Button>
            </a>
          </Card>
        </div>
      </div>
    );
  }

  // No company assigned
  if (!hasCompany) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl">
          <Card variant="glass" className="p-8 md:p-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Company Not Detected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload and analyze a roster first. Your airline will be detected automatically
              so we can compare you with your peers.
            </p>
            <Button variant="glow" size="sm" onClick={() => setActiveTab('rosters')}>
              Upload Roster
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
          <PageHeader companyName={user?.company_name} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} variant="glass" className="animate-pulse">
                <CardContent className="p-4 md:p-5 space-y-3">
                  <div className="h-4 w-24 rounded bg-muted-foreground/10" />
                  <div className="h-8 w-16 rounded bg-muted-foreground/10" />
                  <div className="h-2 w-full rounded bg-muted-foreground/10" />
                  <div className="h-3 w-32 rounded bg-muted-foreground/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (isError || !metrics) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <PageHeader companyName={user?.company_name} />
          <Card variant="glass" className="p-8 text-center">
            <p className="text-sm text-critical">
              Failed to load comparative metrics. Please try again later.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Find the best (most specific) group for headline
  const companyGroup = metrics.groups.find(g => g.group_type === 'company');
  const fleetGroup = metrics.groups.find(g => g.group_type === 'fleet');
  const roleGroup = metrics.groups.find(g => g.group_type === 'role');
  const perfPosition = metrics.positions.find(
    p => p.metric === 'performance' && p.group_type === (fleetGroup ? 'fleet' : 'company')
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        {/* Header + month selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <PageHeader companyName={user?.company_name} />

          {availableMonths.length > 0 && (
            <Select
              value={selectedMonth ?? metrics.month}
              onValueChange={(v) => setSelectedMonth(v)}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {formatMonth(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Headline percentile card */}
        {perfPosition && (
          <HeadlineCard
            month={metrics.month}
            position={perfPosition}
            pilotPerf={metrics.pilot.avg_performance}
            groupLabel={fleetGroup ? groupLabel('fleet', fleetGroup.group_value) : 'Company'}
            groupAvg={fleetGroup?.avg_performance ?? companyGroup?.avg_performance ?? null}
            sampleSize={(fleetGroup ?? companyGroup)?.sample_size ?? 0}
          />
        )}

        {/* Insufficient data notice */}
        {!metrics.has_sufficient_data && (
          <Card variant="glass" className="p-4 border-amber-500/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Fewer than 5 pilots in your company have uploaded rosters for {formatMonth(metrics.month)}.
                Peer comparisons will appear once more colleagues join.
              </p>
            </div>
          </Card>
        )}

        {/* Metric comparison cards */}
        {metrics.has_sufficient_data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              label="Avg Performance"
              icon={<Activity className="h-4 w-4" />}
              value={metrics.pilot.avg_performance}
              unit="%"
              groups={metrics.groups}
              metricKey="avg_performance"
              positions={metrics.positions.filter(p => p.metric === 'performance')}
              tooltip={FATIGUE_INFO.performance}
              higherIsBetter
            />
            <MetricCard
              label="Sleep Debt"
              icon={<Moon className="h-4 w-4" />}
              value={metrics.pilot.avg_sleep_debt}
              unit="h"
              groups={metrics.groups}
              metricKey="avg_sleep_debt"
              positions={metrics.positions.filter(p => p.metric === 'sleep_debt')}
              tooltip={FATIGUE_INFO.sleepDebt}
              higherIsBetter={false}
            />
            <MetricCard
              label="Duty Hours"
              icon={<Timer className="h-4 w-4" />}
              value={metrics.pilot.total_duty_hours}
              unit="h"
              groups={metrics.groups}
              metricKey="avg_duty_hours"
              positions={[]}
            />
            <MetricCard
              label="Avg Sleep / Night"
              icon={<Moon className="h-4 w-4" />}
              value={metrics.pilot.avg_sleep_per_night}
              unit="h"
              groups={metrics.groups}
              metricKey="avg_sleep_per_night"
              positions={[]}
              higherIsBetter
            />
            <MetricCard
              label="High-Risk Duties"
              icon={<ShieldAlert className="h-4 w-4" />}
              value={metrics.pilot.high_risk_duty_count}
              unit=""
              groups={metrics.groups}
              metricKey="high_risk_duty_rate"
              positions={[]}
              isRate
            />
            <MetricCard
              label="Sectors"
              icon={<TrendingUp className="h-4 w-4" />}
              value={metrics.pilot.total_sectors}
              unit=""
              groups={metrics.groups}
              metricKey="avg_sector_count"
              positions={[]}
            />
          </div>
        )}

        {/* Trend chart */}
        {trend && trend.months.length > 1 && (
          <TrendChart trend={trend} />
        )}
      </div>
    </div>
  );
}


// ── Sub-Components ───────────────────────────────────────────

function PageHeader({ companyName }: { companyName?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <Users className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-semibold">Compare</h2>
      {companyName && (
        <Badge variant="outline" className="text-[10px]">{companyName}</Badge>
      )}
    </div>
  );
}


function HeadlineCard({
  month,
  position,
  pilotPerf,
  groupLabel: label,
  groupAvg,
  sampleSize,
}: {
  month: string;
  position: PercentilePosition;
  pilotPerf: number | null;
  groupLabel: string;
  groupAvg: number | null;
  sampleSize: number;
}) {
  const pct = position.percentile;
  const diff = position.vs_avg;
  const isAbove = diff !== null && diff > 0;

  return (
    <Card variant="glass" className={cn('border', pct !== null && pct >= 50 ? 'border-emerald-500/20' : 'border-amber-500/20')}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{formatMonth(month)} — You vs. {label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{pilotPerf?.toFixed(1) ?? '—'}%</span>
              {diff !== null && (
                <span className={cn('flex items-center gap-0.5 text-sm font-medium', isAbove ? 'text-emerald-500' : 'text-amber-500')}>
                  {isAbove ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(diff).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {groupAvg !== null ? `${label} average: ${groupAvg.toFixed(1)}%` : 'No group average available'}
              {sampleSize > 0 && <span className="text-muted-foreground/60"> · n={sampleSize}</span>}
            </p>
          </div>

          {/* Percentile gauge */}
          {pct !== null && (
            <div className="flex flex-col items-center">
              <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', percentileBg(pct))}>
                <span className={cn('text-xl font-bold tabular-nums', percentileColor(pct))}>
                  {Math.round(pct)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-1">percentile</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function MetricCard({
  label,
  icon,
  value,
  unit,
  groups,
  metricKey,
  positions,
  tooltip,
  higherIsBetter,
  isRate,
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  unit: string;
  groups: GroupMetrics[];
  metricKey: keyof GroupMetrics;
  positions: PercentilePosition[];
  tooltip?: { description: string; reference?: string };
  higherIsBetter?: boolean;
  isRate?: boolean;
}) {
  // Find best group metric (fleet > role > company)
  const group = groups.find(g => g.group_type === 'fleet')
    ?? groups.find(g => g.group_type === 'role')
    ?? groups.find(g => g.group_type === 'company');

  const groupVal = group ? (group[metricKey] as number | null) : null;
  const position = positions.length > 0 ? positions[0] : null;

  // Delta
  let delta: number | null = null;
  if (value !== null && groupVal !== null) {
    delta = value - groupVal;
  }

  const deltaIsGood = delta !== null && (
    higherIsBetter ? delta > 0 : !higherIsBetter ? delta < 0 : false
  );

  return (
    <Card variant="glass" className="group">
      <CardContent className="p-4 md:p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-xs font-medium">{label}</span>
            {tooltip && <InfoTooltip entry={tooltip} size="sm" />}
          </div>
          {position?.percentile != null && (
            <Badge variant="outline" className={cn('text-[10px]', percentileColor(position.percentile))}>
              P{Math.round(position.percentile)}
            </Badge>
          )}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums">
            {value !== null ? (isRate ? value : value.toFixed(1)) : '—'}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>

        {/* Group comparison bar */}
        {group && groupVal !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{groupLabel(group.group_type, group.group_value)} avg</span>
              <span className="font-mono">
                {isRate ? `${(groupVal * 100).toFixed(0)}%` : `${groupVal.toFixed(1)}${unit}`}
              </span>
            </div>

            {/* Visual bar */}
            {!isRate && value !== null && groupVal !== null && groupVal > 0 && (
              <div className="relative h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className={cn(
                    'absolute top-0 left-0 h-full rounded-full transition-all',
                    deltaIsGood ? 'bg-emerald-500/60' : delta !== null ? 'bg-amber-500/60' : 'bg-primary/40',
                  )}
                  style={{ width: `${Math.min(100, (value / groupVal) * 50)}%` }}
                />
                {/* Group average marker at 50% */}
                <div className="absolute top-0 left-1/2 h-full w-0.5 bg-muted-foreground/30" />
              </div>
            )}

            {/* Delta label */}
            {delta !== null && (
              <div className="flex items-center gap-1">
                {deltaIsGood ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : delta !== 0 ? (
                  <TrendingDown className="h-3 w-3 text-amber-500" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={cn('text-[10px] font-medium', deltaIsGood ? 'text-emerald-500' : delta !== 0 ? 'text-amber-500' : 'text-muted-foreground')}>
                  {delta > 0 ? '+' : ''}{isRate ? `${(delta * 100).toFixed(0)}%` : `${delta.toFixed(1)}${unit}`} vs. peers
                </span>
              </div>
            )}

            {/* Sample size */}
            <p className="text-[9px] text-muted-foreground/50">
              n={group.sample_size} pilots
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function TrendChart({ trend }: { trend: { months: Array<{ month: string; your_performance: number | null; group_avg_performance: number | null; percentile: number | null; sample_size: number }> } }) {
  const data = trend.months.map(m => ({
    month: formatShortMonth(m.month),
    'You': m.your_performance,
    'Fleet Avg': m.group_avg_performance,
  }));

  return (
    <Card variant="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Performance Trend vs. Peers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[40, 100]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload?.length) {
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-xs font-medium mb-1.5">{label}</p>
                      {payload.map((entry: any, i: number) => (
                        <p key={i} className="text-xs">
                          <span className="text-muted-foreground">{entry.name}: </span>
                          <span className="font-mono font-medium" style={{ color: entry.color }}>
                            {entry.value?.toFixed(1) ?? '—'}%
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={77}
              stroke="hsl(var(--warning))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="Fleet Avg"
              fill="hsl(var(--primary))"
              fillOpacity={0.08}
              stroke="hsl(var(--primary))"
              strokeOpacity={0.3}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="You"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
