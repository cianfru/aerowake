/** In-flight sleepiness log: server sync (fatigue-tool/study/inflight.py). */
import { apiFetch, getAuthHeaders } from '@/lib/auth-session';
import type { InflightEntry } from '@/lib/offline-store';

const API = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

export interface InflightResult {
  client_id: string;
  status: 'saved' | 'rejected';
  reason?: string;
  entry?: { id: string; predicted_kss: number | null };
}

/** Send device entries; one result per entry. Throws when the server cannot be reached. */
export async function postInflightLog(entries: InflightEntry[]): Promise<InflightResult[]> {
  const res = await apiFetch(`${API}/api/inflight-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      entries: entries.map((e) => ({
        client_id: e.clientId,
        recorded_at_utc: e.recordedAtUtc,
        kss: e.kss,
        phase: e.phase ?? null,
        note: e.note ?? null,
        analysis_id: e.analysisId ?? null,
        duty_id: e.dutyId ?? null,
        duty_report_utc: e.dutyReportUtc ?? null,
        recorded_offline: e.recordedOffline,
        prediction_seen: true,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not save your ratings yet.');
  }
  return (await res.json()).results as InflightResult[];
}

export async function deleteInflightEntry(serverId: string): Promise<void> {
  const res = await apiFetch(`${API}/api/inflight-log/${encodeURIComponent(serverId)}`, {
    method: 'DELETE', headers: { ...getAuthHeaders() },
  });
  if (!res.ok && res.status !== 404) throw new Error('Could not delete the rating from your account.');
}

/** Restore the account's most recent saved ratings after device data was cleared. */
export async function loadInflightLog(owner: string): Promise<InflightEntry[]> {
  const res = await apiFetch(`${API}/api/inflight-log`, { headers: { ...getAuthHeaders() } });
  if (!res.ok) throw new Error('Could not load your account ratings. Device ratings remain available.');
  const rows = await res.json() as Array<{
    id: string; client_id: string; recorded_at_utc: string; kss: number;
    phase: InflightEntry['phase']; note: string | null; analysis_id: string | null;
    duty_id: string | null; duty_report_utc: string | null; recorded_offline: boolean;
    predicted_kss: number | null;
  }>;
  return rows.map((row) => ({
    clientId: row.client_id, owner, recordedAtUtc: row.recorded_at_utc, kss: row.kss,
    phase: row.phase, note: row.note, analysisId: row.analysis_id,
    dutyId: row.duty_id, dutyReportUtc: row.duty_report_utc,
    recordedOffline: row.recorded_offline, status: 'synced', serverId: row.id,
    predictedKss: row.predicted_kss,
  }));
}
