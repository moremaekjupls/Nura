import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { tg } from '@/lib/telegram';
import { useI18n } from '@/lib/i18n';

interface SheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
  /** Height fits content instead of filling the screen. */
  compact?: boolean;
}

/**
 * Bottom sheet on Liquid Glass. Escape and the backdrop close it; inside
 * Telegram the native Back button does too. Body scroll is locked while open.
 */
export function Sheet({ open, onClose, title, children, footer, headerRight, compact }: SheetProps) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add('locked');
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    const back = () => closeRef.current();
    const wa = tg();
    wa?.BackButton.onClick(back);
    wa?.BackButton.show();
    return () => {
      document.body.classList.remove('locked');
      window.removeEventListener('keydown', onKey);
      wa?.BackButton.offClick(back);
      wa?.BackButton.hide();
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} aria-hidden />
      <div ref={ref} className={`sheet glass${compact ? ' auto' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="grabber" />
        <div className="sheet-head">
          <button className="circ lg glass" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} strokeWidth={2.2} />
          </button>
          <h2 id={titleId}>{title}</h2>
          <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{headerRight}</div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
