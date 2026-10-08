import { useMemo } from 'react';
import { format } from 'date-fns';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock } from 'lucide-react';
import type { DutyAnalysis, BodyClockTimelineEntry } from '@/types/fatigue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FATIGUE_INFO, InfoTooltip } from '@/components/ui/InfoTooltip';
import { bodyClockSamples } from '@/lib/body-clock';
import { formatHomeDate, formatHomeTime } from '@/lib/home-time';

interface BodyClockDriftChartProps {
  duties: DutyAnalysis[];
  month: Date;
  homeBase: string;
  homeBaseTimezone?: string;
  bodyClockTimeline?: BodyClockTimelineEntry[];
}

export function BodyClockDriftChart({ month, homeBase, homeBaseTimezone, bodyClockTimeline = [] }: BodyClockDriftChartProps) {
  const zone = homeBaseTimezone || 'UTC';
  const monthKey = format(month, 'yyyy-MM');
  const samples = useMemo(() => bodyClockSamples(bodyClockTimeline, monthKey, zone), [bodyClockTimeline, monthKey, zone]);
  const extent = Math.max(2, ...samples.map(sample => Math.ceil(Math.abs(sample.phaseShiftHours))));
  const dateLabel = (instant: number) => formatHomeDate(new Date(instant).toISOString(), zone);
  const shiftLabel = (shift: number) => `${shift > 0 ? '+' : ''}${shift.toFixed(1)}h`;
  return <Card variant="glass" className="min-w-0">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-5 w-5 text-primary" aria-hidden="true" />Body-clock shift<InfoTooltip entry={FATIGUE_INFO.circadian} /></CardTitle>
      <p className="text-sm text-muted-foreground">Modelled phase relative to {homeBase}. Dates in {homeBaseTimezone ? `${homeBase} home time` : 'UTC (home timezone unavailable)'}.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      {samples.length ? <>
        <div className="h-56" role="img" aria-label="Modelled body-clock shift. Exact samples are available below.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={samples} margin={{ top: 12, right: 12, bottom: 12, left: -12 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="instant" type="number" domain={['dataMin', 'dataMax']} tickFormatter={instant => dateLabel(instant).replace(/^\S+ /, '')} minTickGap={40} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[-extent, extent]} tickFormatter={shiftLabel} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip labelFormatter={value => `${dateLabel(Number(value))} ${formatHomeTime(new Date(Number(value)).toISOString(), zone)}`} formatter={value => [shiftLabel(Number(value)), 'Modelled phase shift']} contentStyle={{ background: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 8 }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Line dataKey="phaseShiftHours" type="linear" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">Positive values mean a phase ahead of home time; negative values mean behind. Lines join supplied model samples only. They do not measure your body clock or predict a recovery date. FTL acclimatisation is assessed separately.</p>
        <details className="rounded-lg border border-border px-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">View {samples.length} model samples</summary>
          <div className="max-h-72 overflow-y-auto pb-3"><table className="w-full text-left text-xs"><caption className="sr-only">Body-clock shift at each supplied timestamp, {zone}</caption><thead><tr><th scope="col" className="py-2">Date and time</th><th scope="col" className="py-2 text-right">Shift from home</th></tr></thead><tbody>{samples.map((sample, i) => <tr key={`${sample.timestampUtc}-${i}`} className="border-t border-border"><td className="py-2">{formatHomeDate(sample.timestampUtc, zone)} · {formatHomeTime(sample.timestampUtc, zone)}</td><td className="py-2 text-right font-mono">{shiftLabel(sample.phaseShiftHours)}</td></tr>)}</tbody></table></div>
        </details>
      </> : <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No body-clock samples are available for this month. Re-analyse the roster to generate them. Airport timezone differences alone cannot establish your body-clock phase.</p>}
    </CardContent>
  </Card>;
}
