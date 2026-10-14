import { InputHTMLAttributes, ReactNode, useLayoutEffect, useRef } from 'react';
import { formatCentsPlain, onlyDigits } from '../format';

interface MaskedProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (digits: string) => void;
  format: (digits: string) => string;
}

export function MaskedInput({ value, onValueChange, format, ...rest }: MaskedProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (caret.current !== null && el && document.activeElement === el) {
      el.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  return (
    <input
      ref={ref}
      inputMode="numeric"
      {...rest}
      value={format(value)}
      onChange={(e) => {
        const text = e.target.value;
        const digitsBefore = onlyDigits(text.slice(0, e.target.selectionStart ?? text.length)).length;
        const shown = format(onlyDigits(text));
        let pos = 0;
        let seen = 0;
        while (pos < shown.length && seen < digitsBefore) {
          if (/\d/.test(shown[pos])) seen++;
          pos++;
        }
        caret.current = pos;
        onValueChange(onlyDigits(shown));
      }}
    />
  );
}

interface CurrencyProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (cents: number) => void;
  max?: number;
}

export function CurrencyInput({ value, onValueChange, max = 100_000_000, ...rest }: CurrencyProps) {
  return (
    <span className="money-field">
      <span aria-hidden="true">R$</span>
      <input
        inputMode="numeric"
        placeholder="0,00"
        {...rest}
        value={value ? formatCentsPlain(value) : ''}
        onChange={(e) => onValueChange(Math.min(Number(onlyDigits(e.target.value) || 0), max))}
      />
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v} className={value === v ? 'on' : ''}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          {label}
        </label>
      ))}
    </div>
  );
}
