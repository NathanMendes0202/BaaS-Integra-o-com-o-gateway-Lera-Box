export type OrderStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED';

export function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  }
  return undefined;
}

export function unwrap(raw: any): any {
  return raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
}

export function str(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

const clean = (value: unknown) => String(value ?? '').trim().toUpperCase();
const APPROVED = ['APPROVED', 'PAID', 'CONFIRMED', 'COMPLETED', 'SUCCESS', 'SUCCEEDED', 'APROVADO', 'PAGO', 'CONFIRMADO', 'CONCLUIDO'];
const DENIED = ['DENIED', 'FAILED', 'FAILURE', 'REFUSED', 'REJECTED', 'DECLINED', 'ERROR', 'NEGADO', 'RECUSADO', 'FALHA'];
const CANCELLED = ['REFUNDED', 'REVERSED', 'VOIDED', 'ESTORNADO'];
const PENDING = ['', 'PENDING', 'PROCESSING', 'WAITING', 'CREATED', 'OPEN', 'PENDENTE', 'PROCESSANDO', 'AGUARDANDO'];

export function normalizeStatus(value: unknown): OrderStatus {
  const s = clean(value);
  if (APPROVED.includes(s)) return 'APPROVED';
  if (DENIED.includes(s)) return 'DENIED';
  if (s.startsWith('EXPIR')) return 'EXPIRED';
  if (s.startsWith('CANCEL') || CANCELLED.includes(s)) return 'CANCELLED';
  return 'PENDING';
}

export function isRecognizedStatus(value: unknown): boolean {
  const s = clean(value);
  return (
    APPROVED.includes(s) ||
    DENIED.includes(s) ||
    CANCELLED.includes(s) ||
    PENDING.includes(s) ||
    s.startsWith('EXPIR') ||
    s.startsWith('CANCEL')
  );
}

export function toList(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  const inner = raw?.items ?? raw?.data ?? raw?.transactions ?? raw?.webhooks ?? [];
  return Array.isArray(inner) ? inner : [];
}
