import { useMemo } from 'react';
import { InfoTooltip, FATIGUE_INFO } from '@/components/ui/InfoTooltip';
import { DutyAnalysis, TimelinePoint } from '@/types/fatigue';
import { decomposePerformance } from '@/lib/fatigue-calculations';
import {
  RISK_LEVELS,
  RISK_LEVEL_KSS_RANGE,
  classifyKss,
  kssLabel,
  resolveKss,
  riskClasses,
  riskCssColor,
  roundKss,
} from '@/lib/risk-scale';
import { formatHomeTime } from '@/lib/home-time';
import { cn } from '@/lib/utils';
import { RiskLabel } from './roster/primitives';

interface PerformanceSummaryCardProps {
  duty: DutyAnalysis;
  /** Home-base IANA zone for the peak time. */
  homeTz?: string;
  /** Short home-base name for time labels, e.g. "DOH". */
  homeLabel?: string;
}

/** Where each band sits on the 1–9 scale. */
const BAND_SPANS: Array<[number, number]> = [[1, 5.5], [5.5, 6.5], [6.5, 7.5], [7.5, 8.5], [8.5, 9]];
const pos = (k: number) => `${((Math.min(9, Math.max(1, k)) - 1) / 8) * 100}%`;

/** KSS 1–9 as a banded tape with a marker at the duty peak (instrument-style, no gauge). */
function KssTape({ kss }: { kss: number }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      <div className="relative h-2">
        <div className="absolute inset-0 flex gap-px overflow-hidden rounded-[3px]">
          {RISK_LEVELS.map((level, i) => (
            <span key={level} className="h-full" style={{ width: `${((BAND_SPANS[i][1] - BAND_SPANS[i][0]) / 8) * 100}%`, background: riskCssColor(level, level === 'low' ? 0.35 : 0.55) }} />
          ))}
        </div>
        <span className="absolute -top-1 bottom-[-4px] w-[3px] -translate-x-1/2 rounded-full bg-foreground" style={{ left: pos(kss), boxShadow: '0 0 0 2px hsl(var(--card))' }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>1 alert</span><span>5</span><span>9 fighting sleep</span>
      </div>
    </div>
  );
}

function Driver({ label, detail, value, max, colour }: { label: string; detail: string; value: number; max: number; colour: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-sm tabular">+{value.toFixed(1)} <span className="text-xs text-muted-foreground">KSS</span></p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: colour }} />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Stat({ label, value, info }: { label: string; value: string; info?: keyof typeof FATIGUE_INFO }) {
  const entry = info ? FATIGUE_INFO[info] : undefined;
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{label}{entry && <InfoTooltip entry={entry} size="sm" />}</p>
      <p className="font-mono text-[15px] font-medium tabular">{value}</p>
    </div>
  );
}

/**
 * The headline of the Details dialog: the duty's peak predicted KSS, when it
 * occurs (home-base 24-hour time) and what drives it (time awake vs body
 * clock, Three Process Model). Neutral ink everywhere except the band.
 */
export function PerformanceSummaryCard({ duty, homeTz, homeLabel }: PerformanceSummaryCardProps) {
  // Worst on-deck point in the timeline (bunk rest excluded)
  const worstPoint = useMemo<TimelinePoint | null>(() => {
    const pts = (duty.timelinePoints ?? []).filter(
      (pt) => !pt.is_in_rest && pt.performance != null && Number.isFinite(pt.performance),
    );
    if (pts.length === 0) return null;
    return pts.reduce((min, pt) => ((pt.performance ?? 100) < (min.performance ?? 100) ? pt : min), pts[0]);
  }, [duty.timelinePoints]);

  const decomp = useMemo(() => worstPoint ? decomposePerformance({
    performance: worstPoint.performance ?? 0,
    sleep_pressure: worstPoint.sleep_pressure,
    circadian: worstPoint.circadian,
    hours_on_duty: worstPoint.hours_on_duty,
    kss: worstPoint.kss,
    kss_90: worstPoint.kss_90,
    p_severe_sleepiness: worstPoint.p_severe_sleepiness,
    hours_awake: worstPoint.hours_awake,
  }) : null, [worstPoint]);

  const kss = resolveKss(duty.maxKss ?? worstPoint?.kss, duty.minPerformance, duty.modelVersion);
  if (kss == null) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="eyebrow">Peak predicted sleepiness</p>
        <p className="mt-2 text-sm text-muted-foreground">No prediction is available for this duty.</p>
      </section>
    );
  }

  const level = classifyKss(kss);
  const kss90 = duty.maxKss90 ?? worstPoint?.kss_90;
  const pSevere = duty.maxPSevere ?? worstPoint?.p_severe_sleepiness;
  const hoursAwake = duty.maxHoursAwake ?? worstPoint?.hours_awake;
  const peakIso = duty.peakTimeUtc ?? worstPoint?.timestamp;
  const peakTime = homeTz ? formatHomeTime(peakIso, homeTz) : '';
  const fdpPeak = duty.kssPeakFdp;
  const showFdpPeak = fdpPeak != null && roundKss(fdpPeak) !== roundKss(kss);

  const drivers = decomp ? [
    { key: 'S', label: 'Time awake', value: decomp.sKss, max: 5.5,
      detail: decomp.hoursAwake != null ? `${decomp.hoursAwake.toFixed(1)}h awake at the peak · ${duty.priorSleep.toFixed(1)}h estimated sleep before` : `${duty.priorSleep.toFixed(1)}h estimated sleep before`,
      colour: 'hsl(var(--primary) / 0.75)' },
    { key: 'C', label: 'Body clock', value: decomp.cKss, max: 2.3,
      detail: duty.woclExposure > 0 ? `${duty.woclExposure.toFixed(1)}h of the duty in the body-clock low (02:00–05:59)` : 'Time of day on the home-base body clock',
      colour: 'hsl(var(--wocl))' },
  ] : [];
  const main = drivers.filter((d) => d.value >= 0.3).sort((a, b) => b.value - a.value)[0];

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: 'var(--shadow-card)' }} aria-labelledby="peak-heading">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p id="peak-heading" className="eyebrow">Peak predicted sleepiness</p>
          <RiskLabel level={level} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className={cn('text-figure font-semibold tabular', riskClasses(level).text)}>
            {kss.toFixed(1)}<span className="ml-1 text-sm font-normal text-muted-foreground">KSS</span>
          </p>
          <div className="min-w-0">
            <p className="text-sm font-medium">{kssLabel(kss)}</p>
            <p className="text-xs text-muted-foreground">
              {RISK_LEVEL_KSS_RANGE[level]}{peakTime ? ` · peak at ${peakTime}${homeLabel ? ` ${homeLabel}` : ''} (home base)` : ''}
            </p>
          </div>
        </div>
        <KssTape kss={kss} />
        {showFdpPeak && (
          <p className="text-xs text-muted-foreground">
            Peak from report to the last on-blocks: <span className="font-mono text-foreground tabular">{fdpPeak!.toFixed(1)}</span>
          </p>
        )}
      </div>

      {(kss90 != null || pSevere != null || hoursAwake != null) && (
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
          {kss90 != null && <Stat label="Sleepier pilots (90th pct)" value={kss90.toFixed(1)} info="kss90" />}
          {pSevere != null && <Stat label="Chance of KSS 7+" value={`${(pSevere * 100).toFixed(0)}%`} info="pSevere" />}
          {hoursAwake != null && <Stat label="Longest time awake" value={`${hoursAwake.toFixed(1)}h`} info="hoursAwake" />}
        </div>
      )}

      {drivers.length > 0 && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {main ? <>Mostly <span className="font-medium text-foreground">{main.label.toLowerCase()}</span> at the peak.</> : 'Close to a rested pilot at the body-clock peak.'} Each bar is the KSS added above a rested pilot at the best time of day.
          </p>
          {drivers.map((d) => <Driver key={d.key} label={d.label} detail={d.detail} value={d.value} max={d.max} colour={d.colour} />)}
        </div>
      )}
    </section>
  );
}
