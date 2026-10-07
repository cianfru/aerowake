import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { sessionGeneration } from '@/lib/auth-session';
import { deleteInflightEntry, loadInflightLog, postInflightLog } from '@/lib/inflight-api';
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
  // Bind pending device work to the authenticated profile and session that
  // scheduled it. A new token may arrive before the new profile renders.
  const binding = useRef({ user, generation: sessionGeneration() });
  if (binding.current.user !== user) binding.current = { user, generation: sessionGeneration() };
  const generation = binding.current.generation;
  const current = useCallback(() => binding.current.user === user
    && generation === sessionGeneration(), [user, generation]);
  const [entries, setEntries] = useState<InflightEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const revision = offlineStore.inflightRevision();
    const rows = await offlineStore.listInflight(owner);
    if (current() && revision === offlineStore.inflightRevision()) setEntries(rows);
  }, [owner, current]);

  const sync = useCallback(async () => {
    if (!isAuthenticated || !isOnline() || !current()) return;
    const revision = offlineStore.inflightRevision();
    const unchanged = () => current() && revision === offlineStore.inflightRevision();
    const pending = (await offlineStore.listInflight(owner)).filter((e) => e.status === 'local');
    if (!pending.length || !unchanged()) return;
    setSyncing(true);
    try {
      for (let i = 0; i < pending.length; i += 100) {
        if (!unchanged()) return;
        const batch = pending.slice(i, i + 100);
        const results = await postInflightLog(batch);
        if (!unchanged()) return;
        for (const r of results) {
          const entry = batch.find((e) => e.clientId === r.client_id);
          if (!entry) continue;
          if (!unchanged()) return;
          await offlineStore.putInflight(r.status === 'saved'
            ? { ...entry, status: 'synced', serverId: r.entry?.id ?? null, predictedKss: r.entry?.predicted_kss ?? null, reason: null }
            : { ...entry, status: 'rejected', reason: r.reason ?? 'Not accepted.' });
        }
      }
      if (current()) setSyncError(null);
    } catch (e) {
      // Offline or server busy: entries stay on the device for the next try.
      if (current()) setSyncError(e instanceof Error ? e.message : 'Could not save your ratings yet.');
    } finally {
      if (current()) setSyncing(false);
      window.dispatchEvent(new Event(CHANGED));
    }
  }, [isAuthenticated, owner, current]);

  const hydrate = useCallback(async () => {
    if (!isAuthenticated || !isOnline() || !current()) return;
    const revision = offlineStore.inflightRevision();
    const unchanged = () => current() && revision === offlineStore.inflightRevision();
    try {
      const saved = await loadInflightLog(owner);
      if (!unchanged()) return;
      // Keep unsynced device entries while restoring the server's saved history.
      const local = await offlineStore.listInflight(owner);
      const pending = new Set(local.filter((entry) => entry.status === 'local').map((entry) => entry.clientId));
      for (const entry of saved) {
        if (!unchanged()) return;
        if (!pending.has(entry.clientId)) await offlineStore.putInflight(entry);
      }
      if (unchanged()) { setLoadError(null); await reload(); }
    } catch {
      if (current()) setLoadError('Could not load your account ratings. Device ratings remain available.');
    }
  }, [isAuthenticated, owner, current, reload]);

  useEffect(() => {
    setEntries([]); setSyncing(false); setSyncError(null); setLoadError(null);
    void reload().then(() => sync()).then(() => hydrate());
    const onChange = () => void reload();
    const onOnline = () => void sync().then(() => hydrate());
    window.addEventListener(CHANGED, onChange);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(CHANGED, onChange);
      window.removeEventListener('online', onOnline);
    };
  }, [reload, sync, hydrate]);

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

  return { entries, add, remove, sync, syncing, syncError, loadError, isAuthenticated };
}
