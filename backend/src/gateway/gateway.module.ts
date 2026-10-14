import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatewayAccount } from './gateway-account.entity';
import { GatewayClient } from './gateway.client';
import { GatewayController } from './gateway.controller';
import { GatewaySessionService } from './gateway-session.service';

@Module({
  imports: [TypeOrmModule.forFeature([GatewayAccount])],
  controllers: [GatewayController],
  providers: [GatewayClient, GatewaySessionService],
  exports: [GatewayClient, GatewaySessionService, TypeOrmModule],
})
export class GatewayModule {}
