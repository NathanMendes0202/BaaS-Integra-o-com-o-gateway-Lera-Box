import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayModule } from '../gateway/gateway.module';
import { Withdrawal } from './withdrawal.entity';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Withdrawal]), GatewayModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService, TypeOrmModule],
})
export class WithdrawalsModule {}
