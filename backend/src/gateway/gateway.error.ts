import { HttpException } from '@nestjs/common';

export class GatewayError extends HttpException {
  constructor(
    public readonly gatewayStatus: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ statusCode: GatewayError.map(gatewayStatus), message, error: 'Erro do gateway' }, GatewayError.map(gatewayStatus));
  }

  private static map(status: number): number {
    if (status === 404) return 404;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403) return 422;
    return 502;
  }
}
