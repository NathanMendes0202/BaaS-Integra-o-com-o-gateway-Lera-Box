import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { GatewayModule } from './gateway/gateway.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        charset: 'utf8mb4',
        timezone: 'Z',
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    CommonModule,
    UsersModule,
    AuthModule,
    GatewayModule,
    CheckoutModule,
    WalletModule,
    WithdrawalsModule,
    WebhooksModule,
    ReconciliationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
