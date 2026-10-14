import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutLink } from '../checkout/checkout-link.entity';
import { Order } from '../checkout/order.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { Withdrawal } from '../withdrawals/withdrawal.entity';
import { Transaction } from './transaction.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Order, CheckoutLink, Withdrawal]), GatewayModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
