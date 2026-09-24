import { Minus, Plus } from 'lucide-react';

export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T | null | undefined; options: { id: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onDec, onInc, decLabel, incLabel }: { value: string; onDec(): void; onInc(): void; decLabel: string; incLabel: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={onDec} aria-label={decLabel}><Minus size={16} strokeWidth={2.4} /></button>
      <span className="q num">{value}</span>
      <button type="button" onClick={onInc} aria-label={incLabel}><Plus size={16} strokeWidth={2.4} /></button>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Ring({ size, stroke, value, color, children }: { size: number; stroke: number; value: number; color: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            className="ring-arc"
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          />
        )}
      </svg>
      {children}
    </>
  );
}
