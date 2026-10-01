import { useId, useState } from 'react';
import { AlertTriangle, Check, FileCheck2, MapPin, PencilLine } from 'lucide-react';
import type { RosterPreview } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Eyebrow } from '../primitives';
import { HomeBaseField } from './HomeBaseField';
import { BASE_SOURCE_LABELS, countryName, offsetsLabel, zoneName } from './import-format';

interface HomeBaseSummaryProps {
  preview: RosterPreview;
  busy: boolean;
  /** Server error for a base the pilot just submitted here. */
  error?: string;
  onChange: (base: string, override: boolean) => void;
  onUseRosterBase: () => void;
}

/**
 * Home base as the import will use it, where it came from, and the only
 * ways to change it: a clearly warned override of the roster header, or a
 * correction when the base was inferred or typed.
 */
export function HomeBaseSummary({ preview, busy, error, onChange, onUseRosterBase }: HomeBaseSummaryProps) {
  const [editing, setEditing] = useState(false);
  const base = preview.home_base;
  const source = preview.base_source ?? 'entered';
  const fromHeader = source === 'roster_header';
  const overridden = !!preview.base_override;
  const headerBase = preview.detected_base_source === 'roster_header' ? preview.detected_base : null;

  const headingId = useId();
  const firstReport = preview.duties[0]?.report_utc;
  const clockChange = (preview.base_utc_offsets?.length ?? 0) > 1;
  const zone = zoneName(preview.home_timezone, firstReport ? new Date(firstReport) : undefined, clockChange);
  const place = [preview.base_city, countryName(preview.base_country)].filter(Boolean).join(', ');
  const offsets = offsetsLabel(preview.base_utc_offsets);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <Eyebrow><span id={headingId}>Home base</span></Eyebrow>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <MapPin className="h-4 w-4 shrink-0 self-center text-primary" aria-hidden="true" />
            <span className="font-mono text-xl font-semibold tracking-wider">{base}</span>
            {place && <span className="text-base text-foreground/90">{place}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {[zone, offsets].filter(Boolean).join(' · ') || preview.home_timezone}
          </p>
          <p className="flex items-center gap-1.5 text-sm">
            {source === 'duty_pattern' ? (
              <><AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <span>{BASE_SOURCE_LABELS.duty_pattern}: please confirm below</span></>
            ) : overridden && headerBase ? (
              <><PencilLine className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Chosen by you instead of {headerBase} from the roster header</span></>
            ) : (
              <>{fromHeader ? <FileCheck2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <PencilLine className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                <span className="text-muted-foreground">{BASE_SOURCE_LABELS[source]}</span></>
            )}
          </p>
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-1">
            {overridden && headerBase ? (
              <ActionLink onClick={onUseRosterBase} disabled={busy}>Use {headerBase} from roster</ActionLink>
            ) : (
              <ActionLink onClick={() => setEditing(true)} disabled={busy}>
                {fromHeader ? 'Use a different base' : 'Change'}
              </ActionLink>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          {fromHeader && (
            <p className="flex gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                Your roster header says <strong>{base}</strong>. Use a different base only if you are based
                elsewhere this month, for example on a temporary base. Home or hotel sleep, body-clock adjustment
                and home-base rest rules will follow the base you enter; roster times are still read as printed.
              </span>
            </p>
          )}
          <HomeBaseField
            label={fromHeader ? 'Base to use instead' : 'Home base'}
            help="3-letter IATA airport code."
            initial={fromHeader ? '' : base}
            submitLabel={fromHeader ? 'Use this base' : 'Update'}
            busy={busy}
            error={error}
            autoFocus
            onSubmit={(value) => {
              if (value === base) { setEditing(false); return; }
              onChange(value, fromHeader);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      <SaveBaseToProfile base={base} />
    </section>
  );
}

function ActionLink({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(); }}
      aria-disabled={disabled || undefined}
      className="-mx-2 rounded-md px-2 py-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Signed-in pilots may store the base on their profile. Never saved automatically. */
function SaveBaseToProfile({ base }: { base: string }) {
  const { isAuthenticated, user, updateProfile } = useAuth();
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'failed'; base?: string }>({ status: 'idle' });
  const profileBase = user?.home_base?.toUpperCase() ?? null;
  if (!isAuthenticated || !user || !updateProfile) return null;
  if (state.status === 'saved' && state.base === base) {
    return <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground"><Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Saved {base} as your home base.</p>;
  }
  if (profileBase === base) return null;

  const save = async () => {
    setState({ status: 'saving' });
    try {
      await updateProfile({ home_base: base });
      setState({ status: 'saved', base });
    } catch {
      setState({ status: 'failed' });
    }
  };
  return (
    <div className="space-y-1">
      <ActionLink onClick={save} disabled={state.status === 'saving'}>
        {state.status === 'saving' ? 'Saving…' : `Save ${base} as my home base`}
      </ActionLink>
      {state.status === 'failed' && (
        <p role="alert" className="text-sm text-destructive">Couldn't save your home base. You can set it later under Account.</p>
      )}
    </div>
  );
}
