/**
 * App navigation: four hubs, each optionally with sub-tabs.
 *
 * The app keeps a single `activeTab` string in AnalysisContext (rendered
 * conditionally by pages/Index.tsx). Older code and saved links may still use
 * the pre-4.0 tab ids ('summary', 'analysis', 'rosters', …); `resolveTab`
 * maps every id — new or legacy — onto a hub plus an optional sub-tab so
 * nothing breaks.
 */

export type HubId = 'roster' | 'fatigue-report' | 'history' | 'learn';

export type HistorySubTab = 'rosters' | 'yearly' | 'compare';
export type LearnSubTab = 'learn' | 'model' | 'pilot-study' | 'about';
export type SubTab = HistorySubTab | LearnSubTab;

export const HUB_IDS: HubId[] = ['roster', 'fatigue-report', 'history', 'learn'];

export const HISTORY_SUB_TABS: Array<{ id: HistorySubTab; label: string }> = [
  { id: 'rosters', label: 'Rosters' },
  { id: 'yearly', label: '12-Month' },
  { id: 'compare', label: 'Compare' },
];

export const LEARN_SUB_TABS: Array<{ id: LearnSubTab; label: string }> = [
  { id: 'learn', label: 'Learn' },
  { id: 'model', label: 'How the model works' },
  { id: 'pilot-study', label: 'Pilot study' },
  { id: 'about', label: 'About' },
];

/** Legacy / alias tab ids → hub (+ sub-tab). */
const TAB_ALIASES: Record<string, { tab: HubId; subTab?: SubTab }> = {
  // Roster hub (home)
  summary: { tab: 'roster' },
  analysis: { tab: 'roster' },
  insights: { tab: 'roster' },
  reports: { tab: 'roster' },
  dashboard: { tab: 'roster' },
  // History hub
  rosters: { tab: 'history', subTab: 'rosters' },
  yearly: { tab: 'history', subTab: 'yearly' },
  compare: { tab: 'history', subTab: 'compare' },
  // Learn hub
  about: { tab: 'learn', subTab: 'about' },
  'pilot-study': { tab: 'learn', subTab: 'pilot-study' },
  model: { tab: 'learn', subTab: 'model' },
  'mathematical-model': { tab: 'learn', subTab: 'model' },
};

export interface ResolvedTab {
  tab: HubId;
  /** Sub-tab to open, or undefined to keep the hub's current / default one. */
  subTab?: SubTab;
}

/**
 * Resolve any tab id (new hub id, legacy id, or "hub:sub" form) to a hub.
 * Unknown ids fall back to the Roster page (home).
 */
export function resolveTab(id: string | null | undefined): ResolvedTab {
  const raw = (id ?? '').trim();
  if (!raw) return { tab: 'roster' };

  // "history:yearly" / "learn:about" form
  const [hub, sub] = raw.split(':');
  if (sub && (HUB_IDS as string[]).includes(hub)) {
    const valid =
      (hub === 'history' && HISTORY_SUB_TABS.some((t) => t.id === sub)) ||
      (hub === 'learn' && LEARN_SUB_TABS.some((t) => t.id === sub));
    return valid ? { tab: hub as HubId, subTab: sub as SubTab } : { tab: hub as HubId };
  }

  if (raw === 'learn') return { tab: 'learn' };
  if ((HUB_IDS as string[]).includes(raw)) return { tab: raw as HubId };
  return TAB_ALIASES[raw] ?? { tab: 'roster' };
}

const DEFAULT_SUB_TAB: Partial<Record<HubId, SubTab>> = {
  history: 'rosters',
  learn: 'learn',
};

export interface TabState {
  activeTab: HubId;
  activeSubTab: SubTab | null;
}

/**
 * Next hub/sub-tab state after navigating to `id` (hub, legacy or "hub:sub").
 * Navigating to a different hub without a sub-tab opens that hub's default.
 */
export function applyTab(state: TabState, id: string): TabState {
  const { tab, subTab } = resolveTab(id);
  if (subTab) return { activeTab: tab, activeSubTab: subTab };
  if (tab === state.activeTab) return { activeTab: tab, activeSubTab: state.activeSubTab };
  return { activeTab: tab, activeSubTab: DEFAULT_SUB_TAB[tab] ?? null };
}
