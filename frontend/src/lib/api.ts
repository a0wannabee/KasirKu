const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  let accessToken = typeof window !== 'undefined' ? localStorage.getItem('pos_access_token') : null;
  
  const headers = new Headers(options.headers || {});
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized -> try token refresh once
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh' && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('pos_refresh_token');
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/login';
        return { ok: false, status: 401, data: null, error: 'Sesi habis, silakan login kembali.' };
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('pos_access_token', refreshData.accessToken);
            if (refreshData.refreshToken) {
              localStorage.setItem('pos_refresh_token', refreshData.refreshToken);
            }
            isRefreshing = false;
            onRefreshed(refreshData.accessToken);
          } else {
            isRefreshing = false;
            localStorage.clear();
            window.location.href = '/login';
            return { ok: false, status: 401, data: null, error: 'Sesi habis, silakan login kembali.' };
          }
        } catch (err) {
          isRefreshing = false;
          localStorage.clear();
          window.location.href = '/login';
          return { ok: false, status: 401, data: null, error: 'Koneksi gagal saat refresh sesi.' };
        }
      }

      // Wait for refresh to finish then retry original request
      return new Promise((resolve) => {
        subscribeTokenRefresh(async (newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          try {
            const retriedRes = await fetch(url, { ...options, headers });
            const retriedData = await retriedRes.json().catch(() => null);
            resolve({
              ok: retriedRes.ok,
              status: retriedRes.status,
              data: retriedData,
              error: !retriedRes.ok ? (retriedData?.error || 'Request failed') : undefined,
            });
          } catch (retryErr: any) {
            resolve({ ok: false, status: 500, data: null, error: retryErr.message });
          }
        });
      });
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: data?.error || `Error ${response.status}: ${response.statusText}`,
      };
    }

    return { ok: true, status: response.status, data };
  } catch (err: any) {
    console.error(`API Error on ${url}:`, err);
    return { ok: false, status: 500, data: null, error: err.message || 'Gagal terhubung ke server backend.' };
  }
}
