import { CloudOff } from 'lucide-react';
import { useAnalysis } from '@/contexts/AnalysisContext';
import { useOnline } from '@/hooks/useOnline';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Says when the roster is the copy saved on this device, and what works offline. */
export function OfflineBanner() {
  const online = useOnline();
  const { restoredFromDeviceAt, forgetDeviceCopy } = useAnalysis();
  if (online && !restoredFromDeviceAt) return null;
  return (
    <div role="status" className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
      <p className="flex min-w-0 items-start gap-2">
        {!online && <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span>
          {online ? 'Reopened from this device' : 'Offline. Showing the roster saved on this device'}
          {restoredFromDeviceAt ? ` (saved ${when(restoredFromDeviceAt)})` : ''}.
          <span className="text-muted-foreground">
            {online ? ' Analyse the roster again for the latest results.'
              : ' Ratings you log are kept and sent when you are back online; changes that re-run the model need a connection.'}
          </span>
        </span>
      </p>
      {online && restoredFromDeviceAt && (
        <button type="button" onClick={forgetDeviceCopy} className="text-xs text-primary underline-offset-2 hover:underline">
          Remove from this device
        </button>
      )}
    </div>
  );
}
