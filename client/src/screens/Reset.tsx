import { FormEvent, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { api, setToken, type Me } from '@/lib/api';
import { errorText } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { tg } from '@/lib/telegram';
import { useAuth } from '@/state/auth';
import { clearPersistedCache } from '@/state/persist';

/** Landing page for the emailed link: /reset#token=… */
export default function Reset() {
  const i18n = useI18n();
  const { t } = i18n;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { setUser } = useAuth();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(token ? null : t('auth.resetInvalid'));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: Me; token: string }>('/api/auth/reset', { method: 'POST', body: { token, password } });
      if (tg()) setToken(r.token);
      qc.clear();
      clearPersistedCache();
      setUser(r.user);
      history.replaceState(null, '', '/');
      navigate('/');
    } catch (err) {
      setError(errorText(err, i18n));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen plain auth fade-in">
      <img className="logo" src="/icons/icon-192.png" alt="" width={88} height={88} />
      <h1>{t('auth.resetTitle')}</h1>
      <p className="tagline">{t('auth.passwordHint')}</p>
      <form className="card pad stack" onSubmit={submit}>
        <label className="field">
          <span>{t('profile.newPassword')}</span>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!token} />
        </label>
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        <button className="btn block" type="submit" disabled={!token || password.length < 8 || busy}>{t('auth.resetSave')}</button>
      </form>
    </main>
  );
}
