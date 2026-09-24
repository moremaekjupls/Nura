import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { persister } from './state/persist';
import Reset from './screens/Reset';
import { Route, Switch, useLocation } from 'wouter';
import { mealForHour, type MealType } from '@shared/nutrition';
import { AuthProvider, useAuth } from './state/auth';
import { I18nContext, makeI18n, useI18n as useI18nFromContext } from './lib/i18n';
import { todayISO } from './lib/dates';
import { ApiError } from './lib/api';
import { ToastProvider } from './ui/Toast';
import { TabBar } from './ui/TabBar';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import Progress from './screens/Progress';
import Profile from './screens/Profile';
import Privacy from './screens/Privacy';
import AddSheet from './screens/AddSheet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000, // must outlive the persisted cache
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    // Fail fast offline with a clear message instead of silently queueing writes.
    mutations: { networkMode: 'always' },
  },
});

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function OfflineBanner() {
  const { t } = useI18nFromContext();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  useEffect(() => {
    document.documentElement.classList.toggle('offline-mode', !online);
  }, [online]);
  if (online) return null;
  return (
    <div className="offline glass" role="status">
      {t('offline.banner')}
    </div>
  );
}

function skipKey(userId: string) {
  return `nura_onb_skip_${userId}`;
}

function Shell() {
  const { user, status } = useAuth();
  const [location] = useLocation();
  const i18n = useMemo(() => makeI18n(user?.lang ?? (navigator.language.startsWith('uz') ? 'uz' : 'ru')), [user?.lang]);
  const [date, setDate] = useState(todayISO());
  const [add, setAdd] = useState<{ open: boolean; meal: MealType }>({ open: false, meal: 'lunch' });
  const [skipped, setSkipped] = useState(() => {
    try {
      return !!user && localStorage.getItem(skipKey(user.id)) === '1';
    } catch {
      return false;
    }
  });

  let content: React.ReactNode;
  if (location === '/privacy') {
    content = <Privacy />;
  } else if (location === '/reset') {
    content = <Reset />;
  } else if (status === 'loading') {
    content = (
      <div className="center">
        <div className="spinner" aria-label="…" />
      </div>
    );
  } else if (!user) {
    content = <Auth />;
  } else if (!user.profileComplete && !skipped && !readSkip(user.id)) {
    content = (
      <Onboarding
        onSkip={() => {
          try {
            localStorage.setItem(skipKey(user.id), '1');
          } catch {
            /* ignore */
          }
          setSkipped(true);
        }}
      />
    );
  } else {
    const openAdd = (meal?: MealType) => {
      const now = new Date();
      setAdd({ open: true, meal: meal ?? mealForHour(now.getHours()) });
    };
    content = (
      <>
        <Switch>
          <Route path="/progress"><Progress /></Route>
          <Route path="/profile"><Profile /></Route>
          <Route><Today date={date} setDate={setDate} onAdd={openAdd} /></Route>
        </Switch>
        <TabBar onAdd={() => openAdd()} />
        <AddSheet
          open={add.open}
          date={date}
          meal={add.meal}
          setMeal={(meal) => setAdd((a) => ({ ...a, meal }))}
          onClose={() => setAdd((a) => ({ ...a, open: false }))}
        />
      </>
    );
  }

  return (
    <I18nContext.Provider value={i18n}>
      <ToastProvider>
        <div className="ambient" aria-hidden />
        <OfflineBanner />
        {content}
      </ToastProvider>
    </I18nContext.Provider>
  );
}

function readSkip(userId: string) {
  try {
    return localStorage.getItem(skipKey(userId)) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: 'v2',
        // Keep only server data; AI results and in-flight state are not worth restoring.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'config' },
      }}
    >
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
