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
  created_at: string;
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
  updateProfile: (data: { display_name?: string; pilot_id?: string; home_base?: string }) => Promise<void>;
}

// ── Token Helpers ────────────────────────────────────────────

function getStoredToken(): string | null {
  return localStorage.getItem('aerowake-token');
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem('aerowake-refresh');
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem('aerowake-token', access);
  localStorage.setItem('aerowake-refresh', refresh);
}

function clearTokens() {
  localStorage.removeItem('aerowake-token');
  localStorage.removeItem('aerowake-refresh');
}

/** Exposed to api-client.ts for attaching Bearer token to requests. */
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Fetch Profile ──
  const fetchProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const user: UserProfile = await res.json();
        setState({ user, isAuthenticated: true, isLoading: false });
      } else if (res.status === 401) {
        // Try refresh
        const refreshed = await tryRefresh();
        if (!refreshed) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  // ── Refresh Token ──
  const tryRefresh = async (): Promise<boolean> => {
    const refresh = getStoredRefreshToken();
    if (!refresh) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (res.ok) {
        const tokens: TokenResponse = await res.json();
        storeTokens(tokens.access_token, tokens.refresh_token);

        // Re-fetch profile with new token
        const profileRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileRes.ok) {
          const user: UserProfile = await profileRes.json();
          setState({ user, isAuthenticated: true, isLoading: false });
          return true;
        }
      }
    } catch {
      // Refresh failed
    }
    return false;
  };

  // ── Init: Check auth on mount ──
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Auto-refresh: every 25 minutes ──
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(async () => {
      const refreshed = await tryRefresh();
      if (!refreshed) {
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }, 25 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

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
    storeTokens(tokens.access_token, tokens.refresh_token);
    await fetchProfile();
  };

  // ── Logout ──
  const logout = async () => {
    const refresh = getStoredRefreshToken();
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
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  // ── Update Profile ──
  const updateProfile = async (data: { display_name?: string; pilot_id?: string; home_base?: string }) => {
    const token = getStoredToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Failed to update profile');
    }

    const user: UserProfile = await res.json();
    setState((prev) => ({ ...prev, user }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateProfile,
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
