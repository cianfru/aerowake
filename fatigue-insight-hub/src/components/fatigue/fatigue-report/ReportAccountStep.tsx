import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CREW_POSITION_OPTIONS, EFFECT_OPTIONS, FACTOR_OPTIONS, KSS_OPTIONS, MITIGATION_OPTIONS, PHASE_OPTIONS, PILOT_ROLE_OPTIONS,
  SAMN_PERELLI_OPTIONS,
  type CrewPosition, type EffectCode, type EventType, type MitigationCode, type PhaseOfFlight, type PilotRole,
} from '@/lib/fatigue-report-api';
import { cn } from '@/lib/utils';
import { ReportTimeInput } from './ReportTimeInput';

export interface PilotDetails { name: string; staff_number: string; rank: string; fleet: string; operator: string }
export interface OperationalInput {
  crewPosition: CrewPosition | ''; pilotRole: PilotRole | ''; phase: PhaseOfFlight | '';
  mitigations: MitigationCode[]; effect: EffectCode | ''; suggestedAction: string;
}

const field = 'block space-y-1.5 text-sm';
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground scroll-mb-28';

function Chip({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-[4px] border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring',
      checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {checked && <span aria-hidden="true">✓</span>}{children}
    </label>
  );
}

/** Step 4: the pilot's own account, operational context and details for the header. */
export function ReportAccountStep(props: {
  eventType: EventType; eventTime: string;
  kss: number | null; setKss: (v: number | null) => void;
  sp: number | null; setSp: (v: number | null) => void;
  ratedAt: string; setRatedAt: (v: string) => void; ratedAtError: string | null;
  tz: string; zone: string; homeTz: string;
  factors: string[]; setFactors: (v: string[]) => void;
  operational: OperationalInput; setOperational: (v: OperationalInput) => void;
  narrative: string; setNarrative: (v: string) => void;
  pilot: PilotDetails; setPilot: (v: PilotDetails) => void; pilotFromRoster: boolean;
  review: React.ReactNode;
}) {
  const { eventType, kss, setKss, sp, setSp, operational: op, setOperational } = props;
  const prospective = eventType === 'roster_concern';
  const set = (patch: Partial<OperationalInput>) => setOperational({ ...op, ...patch });
  const rate = (setter: (v: number | null) => void, value: number | null) => {
    setter(value);
    if (value != null && !props.ratedAt && !prospective) props.setRatedAt(props.eventTime);
  };

  return (
    <div className="space-y-8">
      {prospective && (
        <p className="border-l-2 border-primary pl-4 text-sm text-muted-foreground">
          Describe why this pattern concerns you, including experience of similar duties. Ratings are optional and must describe how you actually felt at a recorded time; leave them blank for future duties.
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">How sleepy did you feel? (KSS)</legend>
        <p className="text-sm text-muted-foreground">Karolinska Sleepiness Scale, at the time you called or felt fatigued.</p>
        <div className="grid gap-1.5">
          {KSS_OPTIONS.map((label, i) => (
            <label key={label} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm scroll-mb-28',
              kss === i + 1 ? 'border-primary bg-primary/10' : 'hover:bg-muted/50')}>
              <input type="radio" name="kss" checked={kss === i + 1} onChange={() => rate(setKss, i + 1)} />
              <span className="w-5 font-semibold tabular-nums">{i + 1}</span>{label}
            </label>
          ))}
        </div>
        {kss != null && <Button type="button" variant="ghost" size="sm" onClick={() => setKss(null)}>Clear KSS</Button>}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">How tired did you feel? (Samn-Perelli)</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SAMN_PERELLI_OPTIONS.map((label, i) => (
            <label key={label} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm scroll-mb-28',
              sp === i + 1 ? 'border-primary bg-primary/10' : 'hover:bg-muted/50')}>
              <input type="radio" name="sp" checked={sp === i + 1} onChange={() => rate(setSp, i + 1)} />
              <span className="w-5 font-semibold tabular-nums">{i + 1}</span>{label}
            </label>
          ))}
        </div>
        {sp != null && <Button type="button" variant="ghost" size="sm" onClick={() => setSp(null)}>Clear Samn-Perelli</Button>}
      </fieldset>
      {(kss !== null || sp !== null) && (
        <div className="space-y-2 border-l-2 border-primary pl-4">
          <ReportTimeInput label="When did you record these ratings?" value={props.ratedAt} onChange={props.setRatedAt}
            tz={props.tz} zone={props.zone} echoTz={props.homeTz} error={props.ratedAtError} />
          <Button type="button" variant="outline" size="sm" onClick={() => props.setRatedAt(props.eventTime)}>Use the event time</Button>
          <p className="text-xs text-muted-foreground">Use the time you actually felt this way. A rating made now should not be assigned to an earlier event.</p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">What contributed?</legend>
        <div className="flex flex-wrap gap-2">
          {FACTOR_OPTIONS.map((f) => (
            <Chip key={f.code} checked={props.factors.includes(f.code)}
              onChange={(v) => props.setFactors(v ? [...props.factors, f.code] : props.factors.filter((x) => x !== f.code))}>{f.label}</Chip>
          ))}
        </div>
      </fieldset>

      {!prospective && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Operational context</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={field}><span className="text-muted-foreground">Crew position</span>
              <select className={select} value={op.crewPosition} onChange={(e) => set({ crewPosition: e.target.value as CrewPosition | '' })}>
                <option value="">Not stated</option>{CREW_POSITION_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select></label>
            <label className={field}><span className="text-muted-foreground">Role at the time</span>
              <select className={select} value={op.pilotRole} onChange={(e) => set({ pilotRole: e.target.value as PilotRole | '' })}>
                <option value="">Not stated</option>{PILOT_ROLE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select></label>
            {eventType === 'fatigue_during_duty' && (
              <label className={field}><span className="text-muted-foreground">Phase of flight</span>
                <select className={select} value={op.phase} onChange={(e) => set({ phase: e.target.value as PhaseOfFlight | '' })}>
                  <option value="">Not stated</option>{PHASE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select></label>
            )}
            <label className={field}><span className="text-muted-foreground">Effect on the operation</span>
              <select className={select} value={op.effect} onChange={(e) => set({ effect: e.target.value as EffectCode | '' })}>
                <option value="">Not stated</option>{EFFECT_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
              </select></label>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Mitigations taken</p>
            <div className="flex flex-wrap gap-2">
              {MITIGATION_OPTIONS.map((m) => (
                <Chip key={m.code} checked={op.mitigations.includes(m.code)}
                  onChange={(v) => set({ mitigations: v ? [...op.mitigations.filter((x) => (m.code === 'none' ? false : x !== 'none')), m.code] : op.mitigations.filter((x) => x !== m.code) })}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      <label className={field}>
        <span className="text-lg font-semibold text-foreground">Your account</span>
        <span className="block text-sm text-muted-foreground">The sequence of duties, what limited your rest, what you noticed and any effect on your work. Include only what you experienced; the report adds model estimates separately.</span>
        <Textarea rows={5} maxLength={5000} value={props.narrative} onChange={(e) => props.setNarrative(e.target.value)} className="scroll-mb-28"
          placeholder="What happened, how you felt, and anything the records do not show (e.g. noisy hotel room, illness, delays)." />
      </label>
      <label className={field}>
        <span className="font-semibold text-foreground">Suggested action <span className="font-normal text-muted-foreground">(optional)</span></span>
        <Textarea rows={2} maxLength={1000} value={op.suggestedAction} onChange={(e) => set({ suggestedAction: e.target.value })} className="scroll-mb-28"
          placeholder="e.g. Review late finish followed by early report on this pairing." />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Your details <span className="font-normal text-muted-foreground">(optional, printed in the report header)</span></legend>
        {props.pilotFromRoster && <p className="text-xs text-muted-foreground">Pre-filled from your roster where available. Edit or clear anything you do not want on the report.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {([['name', 'Name'], ['staff_number', 'Staff number'], ['rank', 'Rank'], ['fleet', 'Fleet'], ['operator', 'Operator']] as const).map(([k, l]) => (
            <label key={k} className={field}><span className="text-muted-foreground">{l}</span>
              <Input value={props.pilot[k]} maxLength={k === 'name' || k === 'operator' ? 120 : 40} className="scroll-mb-28"
                onChange={(e) => props.setPilot({ ...props.pilot, [k]: e.target.value })} /></label>
          ))}
        </div>
      </fieldset>

      {props.review}
    </div>
  );
}
