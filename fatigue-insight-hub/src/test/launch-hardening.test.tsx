import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrewRestTimeline } from '@/components/fatigue/CrewRestTimeline';
import { classifyKss, classifyPerformance, resolveKss } from '@/lib/risk-scale';
import { transformAnalysisResult } from '@/lib/transform-analysis';
import { rosterFixture } from './fixtures/roster-analysis';
import { localInputToUtcIso } from '@/lib/fatigue-report-api';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('launch contracts', () => {
  it.each([5.5,6.5,7.5,8.5])('agrees at exact KSS boundary %s', kss => {
    expect(classifyPerformance(110 - 10*kss)).toBe(classifyKss(kss));
  });
  it('requires an identified model before converting legacy indices', () => {
    expect(resolveKss(undefined, 70)).toBeNull();
    expect(resolveKss(undefined,70,'aerowake-3')).toBeNull();
    expect(resolveKss(undefined,70,'aerowake-4.0-kss')).toBe(4);
    expect(resolveKss(99,undefined)).toBeNull();
  });
  it('rejects both DST folds and gaps instead of silently changing the instant', () => {
    expect(localInputToUtcIso('2026-03-29T01:30','Europe/London')).toBeNull();
    expect(localInputToUtcIso('2026-10-25T01:30','Europe/London')).toBeNull();
    expect(localInputToUtcIso('2026-10-25T01:30','UTC')).toBe('2026-10-25T01:30:00.000Z');
  });
  it('can render crew rest when a previously empty duty is populated', () => {
    const duty=transformAnalysisResult(rosterFixture,new Date(2026,8,1)).duties[0];
    const view=render(<CrewRestTimeline duty={{...duty,inflightRestBlocks:[]}} />);
    view.rerender(<CrewRestTimeline duty={{...duty,inflightRestBlocks:[{startUtc:'2026-09-01T09:00:00Z',endUtc:'2026-09-01T10:00:00Z',startHomeTz:null,endHomeTz:null,startDayHomeTz:null,startHourHomeTz:null,endDayHomeTz:null,endHourHomeTz:null,startIsoHomeTz:null,endIsoHomeTz:null,qualityFactor:.7,environment:'bunk',crewMemberId:null,durationHours:1,effectiveSleepHours:.7,crewSet:'crew_a',isDuringWocl:false,source:'roster_ir',approvedPlan:null}]}} />);
    expect(screen.getByText(/Crew A/i)).toBeInTheDocument();
  });
});

describe('session refresh', () => {
  it('shares one refresh request between concurrent API consumers', async () => {
    const {storeTokens, refreshSession, clearTokens}=await import('@/lib/auth-session');
    clearTokens();storeTokens('old','refresh');
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'new',refresh_token:'next'}),{status:200}));
    vi.stubGlobal('fetch',fetch);
    expect(await Promise.all([refreshSession(),refreshSession()])).toEqual([true,true]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('aerowake-token')).toBe('new');
  });
  it('cannot restore a session after logout while refresh is pending', async () => {
    const {storeTokens, refreshSession, clearTokens}=await import('@/lib/auth-session');
    clearTokens();storeTokens('old','refresh');
    let finish!: (v:Response)=>void;
    vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    const pending=refreshSession();clearTokens();
    finish(new Response(JSON.stringify({access_token:'new',refresh_token:'next'}),{status:200}));
    expect(await pending).toBe(false);
    expect(localStorage.getItem('aerowake-token')).toBeNull();
  });
});
