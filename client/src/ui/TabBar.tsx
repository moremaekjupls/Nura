import { Link, useLocation } from 'wouter';
import { LineChart, Plus, Salad, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function TabBar({ onAdd }: { onAdd(): void }) {
  const { t } = useI18n();
  const [loc] = useLocation();
  const tabs = [
    { href: '/', label: t('tab.today'), Icon: Salad },
    { href: '/progress', label: t('tab.progress'), Icon: LineChart },
    { href: '/profile', label: t('tab.profile'), Icon: UserRound },
  ];
  return (
    <nav className="tabbar" aria-label="Nura">
      <div className="tabs glass">
        {tabs.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="tab" aria-current={loc === href ? 'page' : undefined}>
            <Icon size={24} strokeWidth={1.8} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <button className="fab glass" onClick={onAdd} aria-label={t('tab.add')}>
        <Plus size={28} strokeWidth={2.2} />
      </button>
    </nav>
  );
}
