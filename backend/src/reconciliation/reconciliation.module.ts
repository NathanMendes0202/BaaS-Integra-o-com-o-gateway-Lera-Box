import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [CheckoutModule, WithdrawalsModule],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
