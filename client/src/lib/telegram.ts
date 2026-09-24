/**
 * Telegram Mini App integration. The SDK script is loaded only when the page
 * was opened from Telegram (it passes launch params in the URL hash), so the
 * PWA pays nothing for it.
 */

type Inset = { top: number; bottom: number; left: number; right: number };

export interface TgWebApp {
  initData: string;
  colorScheme: 'light' | 'dark';
  platform: string;
  safeAreaInset?: Inset;
  contentSafeAreaInset?: Inset;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  onEvent(event: string, cb: () => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'soft'): void;
    notificationOccurred(type: 'success' | 'error' | 'warning'): void;
    selectionChanged(): void;
  };
  isVersionAtLeast?(v: string): boolean;
  requestWriteAccess?(cb: (granted: boolean) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TgWebApp };
  }
}

let webApp: TgWebApp | null = null;

export const tg = () => webApp;

function launchedFromTelegram(): boolean {
  if (/tgWebApp/.test(window.location.hash)) return true;
  try {
    return !!sessionStorage.getItem('__telegram__initParams');
  } catch {
    return false;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('telegram sdk'));
    document.head.appendChild(s);
  });
}

function applyInsets(wa: TgWebApp) {
  const root = document.documentElement.style;
  const a = wa.safeAreaInset ?? { top: 0, bottom: 0 };
  const c = wa.contentSafeAreaInset ?? { top: 0, bottom: 0 };
  root.setProperty('--tg-top', `${(a.top || 0) + (c.top || 0)}px`);
  root.setProperty('--tg-bottom', `${(a.bottom || 0) + (c.bottom || 0)}px`);
}

function applyTheme(wa: TgWebApp) {
  document.documentElement.dataset.theme = wa.colorScheme;
  const bg = wa.colorScheme === 'dark' ? '#0F1110' : '#F4F1EB';
  wa.setHeaderColor?.(bg);
  wa.setBackgroundColor?.(bg);
  wa.setBottomBarColor?.(bg);
}

export async function initTelegram(): Promise<TgWebApp | null> {
  if (!launchedFromTelegram()) return null;
  try {
    await loadScript('https://telegram.org/js/telegram-web-app.js');
  } catch {
    return null;
  }
  const wa = window.Telegram?.WebApp;
  if (!wa?.initData) return null;
  webApp = wa;
  document.documentElement.classList.add('in-telegram');
  wa.ready();
  wa.expand();
  wa.disableVerticalSwipes?.();
  applyTheme(wa);
  applyInsets(wa);
  wa.onEvent('themeChanged', () => applyTheme(wa));
  wa.onEvent('safeAreaChanged', () => applyInsets(wa));
  wa.onEvent('contentSafeAreaChanged', () => applyInsets(wa));
  return wa;
}

export function haptic(kind: 'light' | 'success' | 'error' | 'select') {
  const h = webApp?.HapticFeedback;
  if (!h) return;
  if (kind === 'light') h.impactOccurred('light');
  else if (kind === 'select') h.selectionChanged();
  else h.notificationOccurred(kind);
}

/** Ask the user to let the bot message them (Bot API 6.9+). Resolves false outside Telegram. */
export function requestWriteAccess(): Promise<boolean> {
  const wa = webApp;
  if (!wa?.requestWriteAccess) return Promise.resolve(false);
  return new Promise((resolve) => wa.requestWriteAccess!((granted) => resolve(granted)));
}
