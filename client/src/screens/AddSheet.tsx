import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, PencilLine, Plus, Search, Sparkles } from 'lucide-react';
import { PRESET_FOODS, type PresetFood } from '@shared/foods';
import { MEAL_TYPES, type MealType } from '@shared/nutrition';
import type { EntryInput, FoodItem } from '@/lib/api';
import { nowHHMM, todayISO } from '@/lib/dates';
import { errorText, portionOf } from '@/lib/format';
import { cap, useI18n } from '@/lib/i18n';
import { photoToBase64 } from '@/lib/image';
import { haptic } from '@/lib/telegram';
import { useAddEntries, useFrequent, useRecognize } from '@/state/queries';
import { Sheet } from '@/ui/Sheet';
import { Stepper } from '@/ui/controls';
import { useToast } from '@/ui/Toast';

/** Something picked but not saved yet. Nutrition is per one portion; `qty` multiplies it. */
interface TrayItem extends FoodItem {
  key: string;
  qty: number;
  preset?: Pick<PresetFood, 'amount' | 'unit'>;
}

interface Props {
  open: boolean;
  date: string;
  meal: MealType;
  setMeal(m: MealType): void;
  onClose(): void;
}

export default function AddSheet({ open, date, meal, setMeal, onClose }: Props) {
  const i18n = useI18n();
  const { t, num, lang } = i18n;
  const toast = useToast();
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'none' | 'text' | 'manual'>('none');
  const [text, setText] = useState('');
  const [aiNote, setAiNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frequent = useFrequent();
  const recognize = useRecognize();
  const addEntries = useAddEntries();

  useEffect(() => {
    if (!open) {
      setTray([]);
      setQuery('');
      setMode('none');
      setText('');
      setAiNote(null);
      recognize.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const push = (items: TrayItem[]) => {
    haptic('light');
    setTray((cur) => {
      const next = [...cur];
      for (const it of items) {
        const i = next.findIndex((x) => x.key === it.key);
        if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + it.qty };
        else next.push(it);
      }
      return next;
    });
  };
  const setQty = (key: string, delta: number) =>
    setTray((cur) => cur.map((x) => (x.key === key ? { ...x, qty: Math.round((x.qty + delta) * 2) / 2 } : x)).filter((x) => x.qty > 0));

  const presetItem = (p: PresetFood): TrayItem => ({
    key: `preset:${p.key}`, name: lang === 'uz' ? p.uz : p.ru, portion: portionOf(p, 1, i18n),
    calories: p.calories, protein: p.protein, fat: p.fat, carbs: p.carbs, qty: 1, preset: p,
  });

  const q = query.trim().toLowerCase();
  const presets = useMemo(
    () => PRESET_FOODS.filter((p) => !q || p.ru.toLowerCase().includes(q) || p.uz.toLowerCase().includes(q)),
    [q],
  );
  const freq = (frequent.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q)).slice(0, q ? 12 : 8);

  const runAi = async (input: Parameters<typeof recognize.mutate>[0]) => {
    setAiNote(null);
    try {
      const r = await recognize.mutateAsync(input);
      if (!r.items.length) {
        setAiNote(r.note || t('add.aiNothing'));
        return;
      }
      push(r.items.map((it, i) => ({ ...it, key: `ai:${Date.now()}:${i}`, qty: 1 })));
      setAiNote(`${t('add.aiApprox')}${r.note ? `. ${r.note}` : ''}`);
      setMode('none');
      setText('');
    } catch (e) {
      setAiNote(errorText(e, i18n));
    }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const { data, mediaType } = await photoToBase64(file);
      await runAi({ kind: 'photo', image: data, mediaType, lang });
    } catch {
      setAiNote(t('common.error'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const total = tray.reduce((a, x) => a + x.calories * x.qty, 0);

  const commit = () => {
    if (!tray.length) return;
    const time = date === todayISO() ? nowHHMM() : null;
    const entries: EntryInput[] = tray.map((x) => ({
      date, mealType: meal, time, name: x.name,
      portion: x.preset ? portionOf(x.preset, x.qty, i18n) : x.qty === 1 ? x.portion || null : `${num(x.qty, x.qty % 1 ? 1 : 0)} × ${x.portion || '1'}`,
      calories: Math.round(x.calories * x.qty), protein: x.protein * x.qty, fat: x.fat * x.qty, carbs: x.carbs * x.qty,
    }));
    addEntries.mutate(entries, {
      onSuccess: () => {
        haptic('success');
        toast.show(cap(t('today.added', { meal: t(`mealLower.${meal}`), kcal: num(total) })));
        onClose();
      },
      onError: (e) => {
        haptic('error');
        toast.show(errorText(e, i18n), { tone: 'error' });
      },
    });
  };

  const cycleMeal = () => setMeal(MEAL_TYPES[(MEAL_TYPES.indexOf(meal) + 1) % MEAL_TYPES.length]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('add.title')}
      headerRight={
        <button className="glass" onClick={cycleMeal} style={{ height: 40, padding: '0 10px 0 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 600 }}>
          {t(`meal.${meal}`)} <ChevronDown size={16} aria-hidden />
        </button>
      }
      footer={
        <button className="btn block" disabled={!tray.length || addEntries.isPending} onClick={commit}>
          {tray.length ? t('add.cta', { meal: t(`mealLower.${meal}`), kcal: num(total) }) : t('add.pick')}
        </button>
      }
    >
      <label className="search mb">
        <Search size={18} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('add.search')} aria-label={t('add.search')} enterKeyHint="search" />
      </label>

      <div className="grid2 mb" style={{ gap: 10 }}>
        <button className="card" style={{ padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => fileRef.current?.click()} disabled={recognize.isPending}>
          <span className="circ" style={{ width: 40, height: 40, background: 'var(--powder)', color: 'var(--on-pastel)' }}><Camera size={22} aria-hidden /></span>
          <span><span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{t('add.photo')}</span><span className="small muted">{t('add.photoSub')}</span></span>
        </button>
        <button className="card" style={{ padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => setMode(mode === 'text' ? 'none' : 'text')} aria-expanded={mode === 'text'} disabled={recognize.isPending}>
          <span className="circ" style={{ width: 40, height: 40, background: 'var(--lavender)', color: 'var(--on-pastel)' }}><Sparkles size={22} aria-hidden /></span>
          <span><span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{t('add.describe')}</span><span className="small muted">{t('add.describeSub')}</span></span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />

      {mode === 'text' && (
        <div className="stack mb fade-in" style={{ gap: 10 }}>
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('add.describePh')} maxLength={500} autoFocus aria-label={t('add.describe')} />
          <button className="btn block secondary" disabled={text.trim().length < 2 || recognize.isPending} onClick={() => runAi({ kind: 'text', text, lang })}>
            {t('add.recognize')}
          </button>
        </div>
      )}

      {recognize.isPending && (
        <div className="note mb fade-in"><div className="spinner" style={{ width: 18, height: 18 }} /><span>{t('add.recognizing')}</span></div>
      )}
      {aiNote && !recognize.isPending && (
        <div className="note mb fade-in"><Sparkles size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden /><span>{aiNote}</span></div>
      )}

      {tray.length > 0 && (
        <>
          <div className="cap" style={{ margin: '4px 4px 8px' }}>{t('add.selected')}</div>
          <div className="card list mb-l">
            {tray.map((x) => (
              <div key={x.key} className="row fade-in">
                <div className="grow">
                  <div className="title" style={{ fontSize: 16 }}>{x.name}</div>
                  <div className="sub num" style={{ fontSize: 13 }}>
                    {x.preset ? portionOf(x.preset, x.qty, i18n) : x.portion} · {num(x.calories * x.qty)} {t('unit.kcal')}
                  </div>
                </div>
                <Stepper
                  value={`×${num(x.qty, x.qty % 1 ? 1 : 0)}`}
                  onDec={() => setQty(x.key, -0.5)}
                  onInc={() => setQty(x.key, 0.5)}
                  decLabel={t('add.less', { name: x.name })}
                  incLabel={t('add.more', { name: x.name })}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {freq.length > 0 && (
        <>
          <div className="cap" style={{ margin: '0 4px 8px' }}>{t('add.frequent')}</div>
          <div className="chips mb-l">
            {freq.map((f) => (
              <button key={f.name} className="chip" onClick={() => push([{ ...f, key: `freq:${f.name}`, qty: 1 }])} aria-label={t('add.addItem', { name: f.name })}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span className="k num">{num(f.calories)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cap" style={{ margin: '0 4px 8px' }}>{t('add.cuisine')}</div>
      <div className="card list mb">
        {presets.map((p) => (
          <div key={p.key} className="row">
            <div className="grow">
              <div className="title" style={{ fontSize: 16 }}>{lang === 'uz' ? p.uz : p.ru}</div>
              <div className="sub num" style={{ fontSize: 13 }}>{portionOf(p, 1, i18n)} · {p.calories} {t('unit.kcal')}</div>
            </div>
            <button className="circ fill" style={{ color: 'var(--accent)' }} onClick={() => push([presetItem(p)])} aria-label={t('add.addItem', { name: lang === 'uz' ? p.uz : p.ru })}>
              <Plus size={18} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        {presets.length === 0 && <div className="row muted" style={{ fontSize: 15 }}>{t('add.notFound')}</div>}
        <button className="row accent" onClick={() => setMode(mode === 'manual' ? 'none' : 'manual')} aria-expanded={mode === 'manual'}>
          <PencilLine size={20} aria-hidden />
          <span>{t('add.manual')}</span>
        </button>
      </div>
      <p className="small muted" style={{ margin: '0 4px 16px' }}>{t('add.estimate')}</p>

      {mode === 'manual' && <ManualForm initialName={query} onAdd={(item) => { push([item]); setMode('none'); }} />}
    </Sheet>
  );
}

function ManualForm({ initialName, onAdd }: { initialName: string; onAdd(item: TrayItem): void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: initialName, portion: '', calories: '', protein: '', fat: '', carbs: '' });
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));
  const kcal = n(f.calories);
  const valid = f.name.trim() && f.calories.trim() && [kcal, n(f.protein), n(f.fat), n(f.carbs)].every((v) => Number.isFinite(v) && v >= 0);
  const input = (key: keyof typeof f, label: string, numeric = true) => (
    <label className="field">
      <span>{label}</span>
      <input className={`input${numeric ? ' num' : ''}`} inputMode={numeric ? 'decimal' : 'text'} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );
  return (
    <div className="card pad stack fade-in mb">
      {input('name', t('add.name'), false)}
      {input('portion', t('add.portion'), false)}
      <div className="grid2">
        {input('calories', `${t('add.calories')}, ${t('unit.kcal')}`)}
        {input('protein', `${t('macro.protein')}, ${t('unit.g')}`)}
        {input('fat', `${t('macro.fat')}, ${t('unit.g')}`)}
        {input('carbs', `${t('macro.carbs')}, ${t('unit.g')}`)}
      </div>
      <button
        className="btn block secondary"
        disabled={!valid}
        onClick={() =>
          onAdd({
            key: `manual:${Date.now()}`, name: f.name.trim(), portion: f.portion.trim() || null, qty: 1,
            calories: kcal, protein: n(f.protein), fat: n(f.fat), carbs: n(f.carbs),
          })
        }
      >
        {t('add.toList')}
      </button>
    </div>
  );
}
