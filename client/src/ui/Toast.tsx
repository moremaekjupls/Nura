import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface ToastState {
  id: number;
  text: string;
  tone: 'normal' | 'error';
  undo?: () => void;
}

const ToastContext = createContext<{ show(text: string, opts?: { undo?: () => void; tone?: 'normal' | 'error' }): void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string, opts: { undo?: () => void; tone?: 'normal' | 'error' } = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone: opts.tone ?? 'normal', undo: opts.undo });
    timer.current = setTimeout(() => setToast(null), opts.undo ? 5000 : 3000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div key={toast.id} className={`toast glass${toast.tone === 'error' ? ' error' : ''}`} role="status" aria-live="polite">
          <span className="grow">{toast.text}</span>
          {toast.undo && (
            <button
              className="btn small"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              {t('common.undo')}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastContext);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
