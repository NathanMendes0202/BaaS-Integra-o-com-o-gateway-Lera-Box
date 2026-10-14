import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0];
      this.logger.log(
        `[${(req as any).correlationId}] ${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms`,
      );
    });
    next();
  }
}
