import { fetchApi } from './api';

export interface UserSession {
  id: string;
  username: string;
  fullName?: string;
  role: 'OWNER' | 'MANAGER' | 'KASIR' | 'GUDANG';
}

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('pos_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function setSession(user: UserSession, accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pos_user', JSON.stringify(user));
  localStorage.setItem('pos_access_token', accessToken);
  localStorage.setItem('pos_refresh_token', refreshToken);
}

export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;
  const refreshToken = localStorage.getItem('pos_refresh_token');
  if (refreshToken) {
    try {
      await fetchApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore errors during logout
    }
  }
  localStorage.clear();
  window.location.href = '/login';
}

export function hasRole(...allowedRoles: string[]): boolean {
  const session = getSession();
  if (!session) return false;
  return allowedRoles.includes(session.role);
}
