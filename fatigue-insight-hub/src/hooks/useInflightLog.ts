import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { deleteInflightEntry, postInflightLog } from '@/lib/inflight-api';
import { offlineStore, type InflightEntry, type InflightPhase } from '@/lib/offline-store';

const CHANGED = 'aerowake-inflight-changed';

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // RFC 4122 v4 shape for older browsers (the server expects a UUID).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Sleepiness ratings logged during a duty. Each rating is saved on this device
 * first (works without a connection) and sent to the account when online and
 * signed in; a resend never duplicates it.
 */
export function useInflightLog() {
  const { user, isAuthenticated } = useAuth();
  const owner = user?.id ?? 'guest';
  const [entries, setEntries] = useState<InflightEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reload = useCallback(async () => setEntries(await offlineStore.listInflight(owner)), [owner]);

  const sync = useCallback(async () => {
    if (!isAuthenticated || !isOnline()) return;
    const pending = (await offlineStore.listInflight(owner)).filter((e) => e.status === 'local');
    if (!pending.length) return;
    setSyncing(true);
    try {
      for (let i = 0; i < pending.length; i += 100) {
        const batch = pending.slice(i, i + 100);
        const results = await postInflightLog(batch);
        for (const r of results) {
          const entry = batch.find((e) => e.clientId === r.client_id);
          if (!entry) continue;
          await offlineStore.putInflight(r.status === 'saved'
            ? { ...entry, status: 'synced', serverId: r.entry?.id ?? null, predictedKss: r.entry?.predicted_kss ?? null, reason: null }
            : { ...entry, status: 'rejected', reason: r.reason ?? 'Not accepted.' });
        }
      }
      setSyncError(null);
    } catch (e) {
      // Offline or server busy: entries stay on the device for the next try.
      setSyncError(e instanceof Error ? e.message : 'Could not save your ratings yet.');
    } finally {
      setSyncing(false);
      window.dispatchEvent(new Event(CHANGED));
    }
  }, [isAuthenticated, owner]);

  useEffect(() => {
    void reload().then(() => sync());
    const onChange = () => void reload();
    const onOnline = () => void sync();
    window.addEventListener(CHANGED, onChange);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(CHANGED, onChange);
      window.removeEventListener('online', onOnline);
    };
  }, [reload, sync]);

  const add = useCallback(async (input: {
    kss: number; recordedAtUtc: string; phase?: InflightPhase | null; note?: string | null;
    analysisId?: string | null; dutyId?: string | null; dutyReportUtc?: string | null;
  }) => {
    await offlineStore.putInflight({
      ...input, clientId: newId(), owner, recordedOffline: !isOnline(), status: 'local',
    });
    window.dispatchEvent(new Event(CHANGED));
    void sync();
  }, [owner, sync]);

  const remove = useCallback(async (entry: InflightEntry) => {
    if (entry.serverId) await deleteInflightEntry(entry.serverId);
    await offlineStore.deleteInflight(entry.clientId);
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { entries, add, remove, sync, syncing, syncError, isAuthenticated };
}
