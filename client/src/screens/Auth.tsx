import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { tg } from '@/lib/telegram';
import { useAuth } from '@/state/auth';
import { Segmented } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { api } from '@/lib/api';
import { useConfig } from '@/state/queries';

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
  const [forgot, setForgot] = useState(false);
  const config = useConfig();

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
      {mode === 'login' && config.data?.passwordReset && (
        <button className="link-btn" style={{ alignSelf: 'center', marginTop: 12 }} onClick={() => setForgot(true)}>{t('auth.forgot')}</button>
      )}
      <ForgotSheet open={forgot} onClose={() => setForgot(false)} initialEmail={email} />
    </main>
  );
}

function ForgotSheet({ open, onClose, initialEmail }: { open: boolean; onClose(): void; initialEmail: string }) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setEmail(initialEmail); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setState('busy');
    setError(null);
    try {
      await api('/api/auth/forgot', { method: 'POST', body: { email, lang } });
      setState('sent');
    } catch (err) {
      setError(errorText(err, i18n));
      setState('idle');
    }
  };

  return (
    <Sheet open={open} onClose={() => { onClose(); setState('idle'); }} title={t('auth.forgotTitle')} compact
      footer={state === 'sent'
        ? <button className="btn block secondary" onClick={onClose}>{t('common.done')}</button>
        : <button className="btn block" disabled={!email.includes('@') || state === 'busy'} onClick={send}>{t('auth.forgotSend')}</button>}>
      {state === 'sent' ? (
        <p style={{ margin: '4px', fontSize: 16, lineHeight: 1.45 }}>{t('auth.forgotSent')}</p>
      ) : (
        <div className="stack">
          <p className="small muted" style={{ margin: '0 4px' }}>{t('auth.forgotHint')}</p>
          <label className="field"><span>{t('auth.email')}</span>
            <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
