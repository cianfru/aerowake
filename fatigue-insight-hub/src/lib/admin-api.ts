// src/lib/admin-api.ts
// Admin dashboard API client — fetches platform-wide data for admin users.

import { getAuthHeaders } from '@/contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MostActiveUser {
  email: string | null;
  display_name: string | null;
  roster_count: number;
}

export interface PlatformStats {
  total_users: number;
  total_rosters: number;
  total_analyses: number;
  users_last_7_days: number;
  rosters_last_7_days: number;
  avg_rosters_per_user: number;
  most_active_users: MostActiveUser[];
}

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  pilot_id: string | null;
  home_base: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  roster_count: number;
  last_upload: string | null;
}

export interface AdminRoster {
  id: string;
  filename: string;
  month: string;
  pilot_id: string | null;
  home_base: string | null;
  config_preset: string | null;
  total_duties: number | null;
  total_sectors: number | null;
  total_duty_hours: number | null;
  total_block_hours: number | null;
  created_at: string;
  has_analysis: boolean;
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
}

export interface ActivityEvent {
  event_type: 'roster_upload' | 'user_signup';
  timestamp: string;
  user_email: string | null;
  user_display_name: string | null;
  details: Record<string, unknown>;
}

// ─── API Functions ───────────────────────────────────────────────────────────

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error');
    throw new Error(`Admin API error (${res.status}): ${detail}`);
  }
  return res.json();
}

export function getAdminStats(): Promise<PlatformStats> {
  return adminFetch('/api/admin/stats');
}

export function getAdminUsers(): Promise<AdminUser[]> {
  return adminFetch('/api/admin/users');
}

export function getAdminRosters(limit = 100, offset = 0): Promise<AdminRoster[]> {
  return adminFetch(`/api/admin/rosters?limit=${limit}&offset=${offset}`);
}

export function getAdminActivity(limit = 50): Promise<ActivityEvent[]> {
  return adminFetch(`/api/admin/activity?limit=${limit}`);
}
