import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getCorrelationId = (): string | undefined =>
  requestContext.getStore()?.correlationId;
