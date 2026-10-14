import { pick } from '../common/gateway-utils';

export function canonicalBrand(value: unknown): string {
  const s = String(value ?? '').toUpperCase();
  if (s.includes('MASTER')) return 'MASTERCARD';
  if (s.includes('VISA')) return 'VISA';
  if (s.includes('ELO')) return 'ELO';
  return s;
}

export interface FeeRow {
  brand: string;
  installments: number;
  feePercent: number;
}

export function normalizeFees(raw: any, defaultBrand?: string): FeeRow[] {
  const rows: FeeRow[] = [];
  const push = (brand: unknown, inst: unknown, pct: unknown) => {
    const installments = Number(inst);
    const feePercent = Number(pct);
    const b = brand ?? defaultBrand;
    if (b && Number.isInteger(installments) && Number.isFinite(feePercent)) {
      rows.push({ brand: canonicalBrand(b), installments, feePercent });
    }
  };
  const fromItem = (brand: unknown, v: any, idx: number) =>
    typeof v === 'object' && v !== null
      ? push(
          pick(v, 'brand', 'bandeira') ?? brand,
          pick(v, 'installments', 'parcelas') ?? idx + 1,
          pick(v, 'feePercent', 'percent', 'taxa', 'fee'),
        )
      : push(brand, idx + 1, v);

  const data = raw?.data ?? raw?.fees ?? raw;
  if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      const nested = pick(item, 'fees', 'installments');
      if (Array.isArray(nested)) {
        nested.forEach((n, i) => fromItem(pick(item, 'brand', 'bandeira'), n, i));
      } else {
        fromItem(undefined, item, idx);
      }
    });
  } else if (data && typeof data === 'object') {
    for (const [key, val] of Object.entries<any>(data)) {
      if (/^\d+$/.test(key)) {
        push(defaultBrand, key, typeof val === 'object' ? pick(val, 'feePercent', 'percent', 'taxa') : val);
      } else if (Array.isArray(val)) {
        val.forEach((v, i) => fromItem(key, v, i));
      } else if (val && typeof val === 'object') {
        for (const [inst, pct] of Object.entries<any>(val)) {
          push(key, inst.replace(/\D/g, ''), typeof pct === 'object' ? pick(pct, 'feePercent', 'percent', 'taxa') : pct);
        }
      }
    }
  }
  return rows;
}
