import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-correlation-id');
    const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    (req as any).correlationId = id;
    res.setHeader('x-correlation-id', id);
    requestContext.run({ correlationId: id }, () => next());
  }
}
