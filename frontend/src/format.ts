export const formatBRL = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function parseBRLToCents(input: string): number | null {
  const s = input.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return Number(int) * 100 + Number(frac.padEnd(2, '0'));
}

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Sucesso',
  DENIED: 'Falha',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendente',
};

export const LINK_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  PROCESSING: 'Em processamento',
  PAID: 'Pago',
  FAILED: 'Negado',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
};

export const METHOD_LABEL: Record<string, string> = { PIX: 'Pix', CARD: 'Cartão' };
export function applyMask(value: string, pattern: string, fill?: string): string {
  const d = onlyDigits(value);
  let i = 0;
  let out = '';
  for (const ch of pattern) {
    if (ch === '0') {
      if (i < d.length) out += d[i++];
      else if (fill !== undefined) out += fill;
      else break;
    } else if (i < d.length || fill !== undefined) {
      out += ch;
    } else break;
  }
  return out;
}

export const CARD_PATTERN = '0000-0000-0000-0000';
export const formatCardNumber = (v: string) => applyMask(v, CARD_PATTERN);
export const formatExpiry = (v: string) => applyMask(v, '00/00');
export const formatCep = (v: string) => applyMask(v, '00000-000');
export const formatCpf = (v: string) => applyMask(v, '000.000.000-00');
export const formatCnpj = (v: string) => applyMask(v, '00.000.000/0000-00');
export const formatCpfCnpj = (v: string) => (onlyDigits(v).length <= 11 ? formatCpf(v) : formatCnpj(v));
export const formatPhone = (v: string) =>
  applyMask(v, onlyDigits(v).length <= 10 ? '(00) 0000-0000' : '(00) 00000-0000');

export const formatCentsPlain = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const feeInCents = (cents: number, percent: number) =>
  Math.round((cents * Math.round(percent * 100)) / 10000);


export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO';
export const BRAND_LABEL: Record<string, string> = { VISA: 'Visa', MASTERCARD: 'Mastercard', ELO: 'Elo' };

export function detectBrand(number: string): CardBrand | null {
  const n = onlyDigits(number);
  const elo =
    /^(401178|401179|431274|438935|451416|457393|457631|457632|504175|506[6-7]\d{2}|509\d{3}|627780|636297|636368|650\d{3}|6516[5-7]\d|6550[0-1]\d|655021|65505[0-8])/;
  if (elo.test(n)) return 'ELO';
  if (/^4/.test(n)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'MASTERCARD';
  return null;
}

export function parseExpiry(digits: string): { month: number; year: number } | null {
  if (digits.length !== 4) return null;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return null;
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return { month, year };
}
