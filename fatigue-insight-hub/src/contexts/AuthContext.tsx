import { getStoredToken, getStoredRefreshToken, storeTokens, clearTokens, getAuthHeaders, apiFetch, sessionChanged, sessionGeneration } from '@/lib/auth-session';
export { getAuthHeaders } from '@/lib/auth-session';
import type { SleepPreferencesPayload } from '@/lib/sleep-preferences';
import { offlineStore } from '@/lib/offline-store';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

// ── Types ────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  pilot_id: string | null;
  home_base: string | null;
  auth_provider: string;
  is_admin: boolean;
  email_verified?: boolean;
  metrics_consent?: boolean;
  company_id: string | null;
  company_name: string | null;
  company_role: string;
  created_at: string;
  /** Usual bedtime, wake-up and nap habit; null = model defaults. */
  sleep_preferences?: SleepPreferencesPayload | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, pilotId?: string, homeBase?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { display_name?: string; pilot_id?: string; home_base?: string; sleep_preferences?: SleepPreferencesPayload }) => Promise<void>;
  confirmCompany: (companyName: string, companyIcao?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ── Token Helpers ────────────────────────────────────────────

// ── Last known profile (offline sign-in) ─────────────────────

const PROFILE_KEY = 'aerowake-profile';

function readCachedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const p = raw ? JSON.parse(raw) as UserProfile : null;
    return p && typeof p.id === 'string' ? p : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(user: UserProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(user)); } catch { /* storage unavailable */ }
}

// ── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const clearPrivateData = useCallback(() => {
    void queryClient.cancelQueries();
    queryClient.clear();
    sessionStorage.removeItem('aerowake-guest');
    localStorage.removeItem('aerowake-pilot-settings');
    localStorage.removeItem(PROFILE_KEY);
    // The offline roster copy goes too; unsynced in-flight ratings stay until they reach the account.
    void offlineStore.clearPrivate();
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('aerowake-report-')) sessionStorage.removeItem(key);
  }, [queryClient]);
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const fetchProfile = useCallback(async () => {
    const started = sessionGeneration();
    const token = getStoredToken();
    if (!token) { setState({ user: null, isAuthenticated: false, isLoading: false }); return; }
    // Offline (in flight) or a server outage keeps the session: the last profile
    // is used until the server answers. Only a refused token signs the pilot out.
    const keepCached = () => {
      const cached = readCachedProfile();
      if (cached) { setState({ user: cached, isAuthenticated: true, isLoading: false }); return true; }
      return false;
    };
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (started !== sessionGeneration()) return;
      if (res.ok) {
        const user = await res.json() as UserProfile;
        writeCachedProfile(user);
        setState({ user, isAuthenticated: true, isLoading: false });
        return;
      }
      if (res.status !== 401 && res.status !== 403 && keepCached()) return;
      clearPrivateData();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    } catch {
      if (started !== sessionGeneration()) return;
      if (getStoredToken() && keepCached()) return;
      clearPrivateData();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, [clearPrivateData]);
  useEffect(() => {
    const expire = () => { clearPrivateData(); setState({ user: null, isAuthenticated: false, isLoading: false }); };
    const switched = (event: StorageEvent) => {
      if (event.key !== 'aerowake-token' && event.key !== null) return;
      sessionChanged(); clearPrivateData();
      setState({ user: null, isAuthenticated: false, isLoading: true });
      void fetchProfile();
    };
    window.addEventListener('aerowake-session-expired', expire);
    window.addEventListener('storage', switched);
    return () => { window.removeEventListener('aerowake-session-expired', expire); window.removeEventListener('storage', switched); };
  }, [clearPrivateData, fetchProfile]);

  // ── Init: Check auth on mount ──
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Auto-refresh: every 25 minutes ──
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(() => { void fetchProfile(); }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated, fetchProfile]);

  // ── Login ──
  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }

    const tokens: TokenResponse = await res.json();
    clearPrivateData();
    clearTokens();
    storeTokens(tokens.access_token, tokens.refresh_token);
    await fetchProfile();
  };

  // ── Register ──
  const register = async (
    email: string,
    password: string,
    displayName?: string,
    pilotId?: string,
    homeBase?: string,
  ) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName || null,
        pilot_id: pilotId || null,
        home_base: homeBase || null,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(error.detail || 'Registration failed');
    }

    const tokens: TokenResponse = await res.json();
    clearPrivateData();
    clearTokens();
    storeTokens(tokens.access_token, tokens.refresh_token);
    await fetchProfile();
  };

  // ── Logout ──
  const logout = async () => {
    const refresh = getStoredRefreshToken();
    clearTokens();
    clearPrivateData();
    setState({ user: null, isAuthenticated: false, isLoading: false });
    if (refresh) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {
        // Best effort
      }
    }
  };

  // ── Confirm Company (after airline detection) ──
  const confirmCompany = async (companyName: string, companyIcao?: string) => {
    const token = getStoredToken();
    if (!token) throw new Error('Not authenticated');

    const res = await apiFetch(`${API_BASE_URL}/api/companies/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        company_name: companyName,
        company_icao: companyIcao || null,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Company confirmation failed' }));
      throw new Error(error.detail || 'Company confirmation failed');
    }

    // Refresh profile to pick up new company assignment
    await fetchProfile();
  };

  // ── Update Profile ──
  const updateProfile = async (data: { display_name?: string; pilot_id?: string; home_base?: string; sleep_preferences?: SleepPreferencesPayload }) => {
    const token = getStoredToken();
    if (!token) throw new Error('Not authenticated');

    const started = sessionGeneration();
    const res = await apiFetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(typeof error.detail === 'string' ? error.detail : 'Failed to update profile');
    }

    const user: UserProfile = await res.json();
    if (started === sessionGeneration()) { writeCachedProfile(user); setState((prev) => ({ ...prev, user })); }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateProfile,
        confirmCompany,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
