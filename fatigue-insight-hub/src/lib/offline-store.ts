/**
 * On-device storage for offline use (IndexedDB, this browser only).
 *
 * - `analysis`: the last roster analysis per owner ('guest' or the user id), so
 *   the roster opens without a connection (in flight). Removed on sign-out.
 * - `inflight`: sleepiness ratings logged during a duty. Kept until the server
 *   confirms them (then marked synced); unsynced ratings are never deleted by
 *   sign-out, so nothing logged offline is lost.
 *
 * Every call fails soft: without IndexedDB (private mode, tests) reads return
 * nothing and writes are skipped.
 */
import type { AnalysisResults } from '@/types/fatigue';

const DB = 'aerowake-offline';
const VERSION = 1;

export interface SavedAnalysis {
  owner: string;
  savedAt: string;
  results: AnalysisResults;
}

export type InflightPhase = 'pre_flight' | 'taxi' | 'takeoff_climb' | 'cruise' | 'descent_approach' | 'landing' | 'post_flight';

export interface InflightEntry {
  clientId: string;
  owner: string;
  recordedAtUtc: string;
  kss: number;
  phase?: InflightPhase | null;
  note?: string | null;
  analysisId?: string | null;
  dutyId?: string | null;
  dutyReportUtc?: string | null;
  recordedOffline: boolean;
  /** 'local' = on this device only; 'synced' = saved to the account; 'rejected' = the server refused it. */
  status: 'local' | 'synced' | 'rejected';
  serverId?: string | null;
  predictedKss?: number | null;
  reason?: string | null;
}

let opening: Promise<IDBDatabase | null> | null = null;
// Invalidates in-flight reads/uploads before an explicit local deletion.
let inflightRevision = 0;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('analysis')) db.createObjectStore('analysis', { keyPath: 'owner' });
        if (!db.objectStoreNames.contains('inflight')) {
          const store = db.createObjectStore('inflight', { keyPath: 'clientId' });
          store.createIndex('owner', 'owner');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

async function run<T>(store: string, mode: IDBTransactionMode, body: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      const req = body(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const offlineStore = {
  saveAnalysis: (owner: string, results: AnalysisResults) =>
    run('analysis', 'readwrite', (s) => s.put({ owner, savedAt: new Date().toISOString(), results } satisfies SavedAnalysis)),
  loadAnalysis: (owner: string) => run<SavedAnalysis | undefined>('analysis', 'readonly', (s) => s.get(owner)),
  removeAnalysis: (owner: string) => run('analysis', 'readwrite', (s) => s.delete(owner)),
  /** Sign-out: every saved roster goes; unsynced ratings stay until they reach the account. */
  async clearPrivate() {
    await run('analysis', 'readwrite', (s) => s.clear());
    const all = await run<InflightEntry[]>('inflight', 'readonly', (s) => s.getAll());
    for (const e of all ?? []) if (e.status !== 'local') await run('inflight', 'readwrite', (s) => s.delete(e.clientId));
  },
  putInflight: (entry: InflightEntry) => run('inflight', 'readwrite', (s) => s.put(entry)),
  inflightRevision: () => inflightRevision,
  deleteInflight: (clientId: string) => {
    inflightRevision++;
    return run('inflight', 'readwrite', (s) => s.delete(clientId));
  },
  /** Explicit delete-all only; sign-out must preserve unsynced ratings. */
  async clearInflight(owner: string) {
    inflightRevision++;
    await run('inflight', 'readwrite', (s) => {
      const cursor = s.index('owner').openCursor(IDBKeyRange.only(owner));
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) { row.delete(); row.continue(); }
      };
    });
  },
  async listInflight(owner: string): Promise<InflightEntry[]> {
    const rows = await run<InflightEntry[]>('inflight', 'readonly', (s) => s.index('owner').getAll(owner));
    return (rows ?? []).sort((a, b) => Date.parse(b.recordedAtUtc) - Date.parse(a.recordedAtUtc));
  },
};
