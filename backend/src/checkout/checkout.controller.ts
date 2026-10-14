import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateLinkDto, PayCardDto, PayPixDto, SendLinkEmailDto, TransactionsQueryDto } from './checkout.dto';
import { LinksService } from './links.service';
import { OrdersService } from './orders.service';

@ApiTags('Checkout (lojista)')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
export class CheckoutController {
  constructor(
    private readonly links: LinksService,
    private readonly orders: OrdersService,
  ) {}

  @Post('checkout/links')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLinkDto) {
    return this.links.create(user.id, dto);
  }

  @Get('checkout/links')
  list(@CurrentUser() user: AuthUser) {
    return this.links.list(user.id);
  }

  @Post('checkout/links/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.links.cancel(user.id, id);
  }

  /** Envia o link de pagamento (somente links ativos) por e-mail para o cliente. */
  @Post('checkout/links/:id/email')
  @HttpCode(200)
  sendEmail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendLinkEmailDto) {
    return this.links.sendByEmail(user.id, id, dto);
  }

  /** Transações do lojista. Filtros: PENDING, APPROVED (sucesso), DENIED (falha), EXPIRED, CANCELLED. */
  @Get('transactions')
  transactions(@CurrentUser() user: AuthUser, @Query() query: TransactionsQueryDto) {
    return this.links.listTransactions(user.id, query.status, query.limit ? Number(query.limit) : 50);
  }

  /** Consulta o status do pagamento no gateway e atualiza o pedido local. */
  @Post('orders/:id/sync')
  sync(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.sync(user.id, id);
  }
}

@ApiTags('Checkout (pagador)')
@Controller('checkout/public')
export class PublicCheckoutController {
  constructor(
    private readonly links: LinksService,
    private readonly orders: OrdersService,
  ) {}

  @Get(':code')
  view(@Param('code') code: string) {
    return this.links.publicView(code);
  }

  @Post(':code/pix')
  pix(@Param('code') code: string, @Body() dto: PayPixDto) {
    return this.orders.payPix(code, dto);
  }

  @Post(':code/card')
  card(@Param('code') code: string, @Body() dto: PayCardDto) {
    return this.orders.payCard(code, dto);
  }

  @Post(':code/check')
  check(@Param('code') code: string) {
    return this.orders.checkByCode(code);
  }

  @Get(':code/receipt')
  receipt(@Param('code') code: string) {
    return this.links.receipt(code);
  }
}
