import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutModule } from '../checkout/checkout.module';
import { GatewayModule } from '../gateway/gateway.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { WebhookEvent } from './webhook-event.entity';
import { WebhookReceiverController, WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent]), GatewayModule, CheckoutModule, WithdrawalsModule],
  controllers: [WebhookReceiverController, WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
