import { FormEvent, useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { tg } from '@/lib/telegram';
import { useAuth } from '@/state/auth';
import { Segmented } from '@/ui/controls';

export default function Auth() {
  const i18n = useI18n();
  const { t } = i18n;
  const { login, register, tgError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(tg() && tgError ? t('auth.tgFailed') : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && !consent) {
      setError(t('auth.needConsent'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
    } catch (err) {
      setError(errorText(err, i18n));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen plain auth fade-in">
      <img className="logo" src="/icons/icon-192.png" alt="" width={88} height={88} />
      <h1>Nura</h1>
      <p className="tagline">{t('app.tagline')}</p>

      <form className="card pad stack" onSubmit={submit} noValidate>
        <Segmented label={t('auth.login')} value={mode} onChange={(m) => { setMode(m); setError(null); }}
          options={[{ id: 'login', label: t('auth.login') }, { id: 'register', label: t('auth.register') }]} />
        <label className="field">
          <span>{t('auth.email')}</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t('auth.password')}</span>
          <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'register' ? 8 : undefined} />
          {mode === 'register' && <span style={{ fontWeight: 400 }}>{t('auth.passwordHint')}</span>}
        </label>
        {mode === 'register' && (
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t('auth.consentA')}<Link href="/privacy">{t('auth.consentLink')}</Link>{t('auth.consentB')}</span>
          </label>
        )}
        {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        <button className="btn block" type="submit" disabled={busy || !email || !password}>
          {mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
        </button>
      </form>
    </main>
  );
}
