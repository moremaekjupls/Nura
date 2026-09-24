import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, Me, restoreToken, setToken } from '@/lib/api';
import { tg } from '@/lib/telegram';

interface AuthValue {
  user: Me | null;
  status: 'loading' | 'ready';
  tgError: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  setUser(u: Me | null): void;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [tgError, setTgError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUser(await api<Me>('/api/auth/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const wa = tg();
      if (wa) {
        try {
          const r = await api<{ user: Me; token: string }>('/api/auth/telegram', { method: 'POST', body: { initData: wa.initData } });
          setToken(r.token);
          setUser(r.user);
        } catch (e) {
          setTgError(e instanceof Error ? e.message : 'telegram');
          restoreToken();
          await refresh();
        }
      } else {
        await refresh();
      }
      setStatus('ready');
    })();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      tgError,
      setUser,
      refresh,
      async login(email, password) {
        const r = await api<{ user: Me; token: string }>('/api/auth/login', { method: 'POST', body: { email, password } });
        if (tg()) setToken(r.token);
        qc.clear();
        setUser(r.user);
      },
      async register(email, password) {
        const r = await api<{ user: Me; token: string }>('/api/auth/register', { method: 'POST', body: { email, password } });
        if (tg()) setToken(r.token);
        qc.clear();
        setUser(r.user);
      },
      async logout() {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        setToken(null);
        qc.clear(); // no cached data may survive into the next account on this device
        setUser(null);
      },
    }),
    [user, status, tgError, refresh, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
