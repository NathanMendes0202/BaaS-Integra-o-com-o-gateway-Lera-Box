import { Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GatewayClient } from './gateway.client';
import { ConnectGatewayDto, FeesQueryDto, RegisterGatewayDto } from './gateway.dto';
import { GatewaySessionService } from './gateway-session.service';

@ApiTags('Conta no gateway')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class GatewayController {
  constructor(
    private readonly client: GatewayClient,
    private readonly session: GatewaySessionService,
  ) {}
  @Get('gateway/account')
  async account(@CurrentUser() user: AuthUser) {
    const account = await this.session.findAccount(user.id);
    if (!account) return { connected: false };
    return {
      connected: true,
      document: account.document,
      clientCode: account.clientCode,
      storeKeyHint: account.storeKey ? `****${account.storeKey.slice(-4)}` : null,
      connectedAt: account.createdAt,
    };
  }

  @Post('gateway/register')
  async register(@Body() dto: RegisterGatewayDto) {
    const raw = await this.client.register({
      personType: dto.personType,
      name: dto.name,
      document: dto.document,
      email: dto.email,
      phone: dto.phone,
      zipCode: dto.zipCode,
      address: dto.address,
      number: dto.number,
      neighborhood: dto.neighborhood,
      city: dto.city,
      state: dto.state.toUpperCase(),
    });
    return {
      message:
        raw?.message ??
        'Cadastro enviado. Confira seu e-mail: o gateway envia documento, senha, CodigoCliente e ChaveLoja.',
    };
  }

  @Post('gateway/connect')
  @HttpCode(200)
  async connect(@CurrentUser() user: AuthUser, @Body() dto: ConnectGatewayDto) {
    const account = await this.session.connect(user.id, dto.document, dto.password);
    return { connected: true, document: account.document, clientCode: account.clientCode };
  }

  @Delete('gateway/account')
  @HttpCode(204)
  async disconnect(@CurrentUser() user: AuthUser) {
    await this.session.disconnect(user.id);
  }
  @Get('fees')
  fees(@Query() query: FeesQueryDto) {
    return this.client.fees(query.brand);
  }
}
