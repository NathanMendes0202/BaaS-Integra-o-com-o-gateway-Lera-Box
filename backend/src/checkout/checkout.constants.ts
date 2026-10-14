import { OrderStatus } from '../common/gateway-utils';

export type LinkStatus = 'ACTIVE' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
export type PaymentMethod = 'PIX' | 'CARD';
export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO';

export const ORDER_TO_LINK: Record<OrderStatus, LinkStatus | null> = {
  PENDING: null,
  APPROVED: 'PAID',
  DENIED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

export const LINK_TO_UI: Record<LinkStatus, OrderStatus> = {
  ACTIVE: 'PENDING',
  PROCESSING: 'PENDING',
  PAID: 'APPROVED',
  FAILED: 'DENIED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

export const UI_TO_LINK: Record<OrderStatus, LinkStatus[]> = {
  PENDING: ['ACTIVE', 'PROCESSING'],
  APPROVED: ['PAID'],
  DENIED: ['FAILED'],
  EXPIRED: ['EXPIRED'],
  CANCELLED: ['CANCELLED'],
};

export function detectBrand(number: string): CardBrand | null {
  const elo =
    /^(401178|401179|431274|438935|451416|457393|457631|457632|504175|506[6-7]\d{2}|509\d{3}|627780|636297|636368|650\d{3}|6516[5-7]\d|6550[0-1]\d|655021|65505[0-8])/;
  if (elo.test(number)) return 'ELO';
  if (/^4/.test(number)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(number)) return 'MASTERCARD';
  return null;
}
