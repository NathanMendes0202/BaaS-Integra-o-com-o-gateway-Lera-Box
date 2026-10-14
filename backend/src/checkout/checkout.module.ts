import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayModule } from '../gateway/gateway.module';
import { MailModule } from '../mail/mail.module';
import { CheckoutController, PublicCheckoutController } from './checkout.controller';
import { CheckoutLink } from './checkout-link.entity';
import { LinksService } from './links.service';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([CheckoutLink, Order]), GatewayModule, MailModule],
  controllers: [CheckoutController, PublicCheckoutController],
  providers: [LinksService, OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class CheckoutModule {}
