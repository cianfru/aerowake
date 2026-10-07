import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInflightLog } from '@/hooks/useInflightLog';
import type { InflightEntry } from '@/lib/offline-store';

const state = vi.hoisted(() => ({ user: { id: 'pilot-a' } as { id: string } | null, generation: 1, revision: 0 }));
const storage = vi.hoisted(() => ({ listInflight: vi.fn(), putInflight: vi.fn(), deleteInflight: vi.fn(), inflightRevision: vi.fn() }));
const post = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, isAuthenticated: !!state.user }) }));
vi.mock('@/lib/auth-session', () => ({ sessionGeneration: () => state.generation }));
vi.mock('@/lib/offline-store', () => ({ offlineStore: storage }));
vi.mock('@/lib/inflight-api', () => ({ postInflightLog: post, loadInflightLog: load, deleteInflightEntry: vi.fn() }));
const rating = { clientId: 'a-rating', owner: 'pilot-a', kss: 6, status: 'local', recordedAtUtc: '2026-10-07T10:00:00Z' } as InflightEntry;

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'pilot-a' }; state.generation++;
  storage.listInflight.mockResolvedValue([]); storage.inflightRevision.mockImplementation(() => state.revision);
  post.mockResolvedValue([]); load.mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe('in-flight account isolation', () => {
  it('does not send the old owner’s queue when the session changes during the device read', async () => {
    let completeRead!: (entries: InflightEntry[]) => void;
    // First read renders; the second reads the queue for upload.
    storage.listInflight.mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise((resolve) => { completeRead = resolve; }));
    const { rerender, result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(storage.listInflight).toHaveBeenCalledTimes(2));
    state.generation++;
    // Token changed, but profile has not rendered yet: still must not send A's records.
    await act(async () => { completeRead([rating]); });
    expect(post).not.toHaveBeenCalled();
    state.user = { id: 'pilot-b' };
    rerender();
    await waitFor(() => expect(storage.listInflight).toHaveBeenCalledWith('pilot-b'));
    expect(result.current.entries).toEqual([]);
  });

  it('ignores a late upload response after the profile changes', async () => {
    let completePost!: (response: unknown[]) => void;
    storage.listInflight.mockImplementation((owner: string) => Promise.resolve(owner === 'pilot-a' ? [rating] : []));
    post.mockImplementation(() => new Promise((resolve) => { completePost = resolve; }));
    const { rerender, result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    state.generation++; state.user = { id: 'pilot-b' };
    rerender();
    await act(async () => { completePost([{ client_id: 'a-rating', status: 'saved', entry: { id: 'server-a' } }]); });
    expect(storage.putInflight).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
    expect(result.current.syncing).toBe(false);
  });

  it('restores saved account ratings after sign-in while keeping unsynced device ratings', async () => {
    const restored = { ...rating, clientId: 'saved-a', status: 'synced' as const, serverId: 'server-a' };
    const rows = [rating];
    storage.listInflight.mockImplementation(() => Promise.resolve([...rows]));
    storage.putInflight.mockImplementation((entry: InflightEntry) => { rows.push(entry); return Promise.resolve(); });
    load.mockResolvedValue([restored]);
    const { result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(load).toHaveBeenCalledWith('pilot-a');
    expect(result.current.entries.map((entry) => entry.clientId)).toEqual(['a-rating', 'saved-a']);
  });

  it('keeps device ratings available when the account history cannot be reached', async () => {
    storage.listInflight.mockResolvedValue([rating]);
    load.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(result.current.loadError).toMatch(/Device ratings remain available/));
    expect(result.current.entries).toEqual([rating]);
    expect(storage.putInflight).not.toHaveBeenCalled();
  });

  it('does not restore one account’s history after switching to another account', async () => {
    let completeLoad!: (entries: InflightEntry[]) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => { completeLoad = resolve; })).mockResolvedValue([]);
    const { rerender, result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(load).toHaveBeenCalledWith('pilot-a'));
    state.generation++; state.user = { id: 'pilot-b' };
    rerender();
    await act(async () => { completeLoad([{ ...rating, status: 'synced' }]); });
    expect(storage.putInflight).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('does not resurrect ratings from a history response started before explicit deletion', async () => {
    let completeLoad!: (entries: InflightEntry[]) => void;
    load.mockImplementationOnce(() => new Promise((resolve) => { completeLoad = resolve; }));
    const { result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(load).toHaveBeenCalledWith('pilot-a'));
    state.revision++;
    await act(async () => { completeLoad([{ ...rating, status: 'synced' }]); });
    expect(storage.putInflight).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([]);
  });

  it('opens device ratings offline without attempting account requests', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    storage.listInflight.mockResolvedValue([rating]);
    const { result } = renderHook(() => useInflightLog());
    await waitFor(() => expect(result.current.entries).toEqual([rating]));
    expect(post).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(result.current.loadError).toBeNull();
  });

});
