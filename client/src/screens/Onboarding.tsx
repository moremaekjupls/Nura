import { useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import { useAuth } from '@/state/auth';
import { useLogWeight, useSaveProfile } from '@/state/queries';
import { useToast } from '@/ui/Toast';
import { BodyFields, bodyValid, toBody, useBodyForm } from './BodyForm';

export default function Onboarding({ onSkip }: { onSkip(): void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const { refresh } = useAuth();
  const [v, set] = useBodyForm({});
  const save = useSaveProfile();
  const weight = useLogWeight();
  const body = toBody(v);
  const valid = bodyValid(body);

  const start = async () => {
    if (!valid) return;
    try {
      await save.mutateAsync({ ...body, autoGoal: true });
      await weight.mutateAsync({ date: todayISO(), kg: body.weightKg });
      await refresh();
    } catch (e) {
      toast.show(errorText(e, i18n), { tone: 'error' });
    }
  };

  return (
    <main className="screen plain fade-in">
      <div className="head">
        <div>
          <h1 className="large-title">{t('onb.title')}</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 16 }}>{t('onb.sub')}</p>
        </div>
      </div>
      <BodyFields v={v} set={set} preview />
      <div className="stack" style={{ marginTop: 24, gap: 10 }}>
        <button className="btn block" disabled={!valid || save.isPending || weight.isPending} onClick={start}>{t('onb.start')}</button>
        <button className="btn block secondary" onClick={onSkip}>{t('onb.skip')}</button>
      </div>
    </main>
  );
}
