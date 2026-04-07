import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { BullModule } from '@nestjs/bullmq';
import { PaymentController } from './adapters/inbound/http/payment.controller';
import { BoothWebsocketGateway } from './adapters/inbound/websocket/booth.gateway';
import { CreatePaymentUseCase } from './core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from './core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from './core/use-cases/expire-payment.usecase';
import { SwitchPaymentUseCase } from './core/use-cases/switch-payment.usecase';
import { CompleteSessionUseCase } from './core/use-cases/complete-session.usecase';
import { MercadoPagoAdapter } from './adapters/outbound/mercadopago/mercadopago.adapter';
import { PrismaAdapter } from './adapters/outbound/prisma/prisma.adapter';
import { PaymentExpirationProcessor } from './infrastructure/queue/payment-expiration.processor';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'payment-expiration' }),
  ],
  controllers: [PaymentController],
  providers: [
    BoothWebsocketGateway,
    PaymentExpirationProcessor,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
    {
      provide: 'PrismaAdapter',
      useFactory: (prisma: PrismaClient) => new PrismaAdapter(prisma),
      inject: [PrismaClient],
    },
    {
      provide: 'MercadoPagoAdapter',
      useFactory: (config: ConfigService) =>
        new MercadoPagoAdapter(
          config.get('MERCADO_PAGO_ACCESS_TOKEN'),
          config.get('WEBHOOK_BASE_URL'),
        ),
      inject: [ConfigService],
    },
    {
      provide: CreatePaymentUseCase,
      useFactory: (mp: MercadoPagoAdapter, pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new CreatePaymentUseCase(mp, pr, pr, ws),
      inject: ['MercadoPagoAdapter', 'PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: ConfirmPaymentUseCase,
      useFactory: (pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new ConfirmPaymentUseCase(pr, pr, ws),
      inject: ['PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: ExpirePaymentUseCase,
      useFactory: (pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new ExpirePaymentUseCase(pr, pr, ws),
      inject: ['PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: SwitchPaymentUseCase,
      useFactory: (mp: MercadoPagoAdapter, pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new SwitchPaymentUseCase(mp, pr, pr, ws),
      inject: ['MercadoPagoAdapter', 'PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: CompleteSessionUseCase,
      useFactory: (pr: PrismaAdapter) => new CompleteSessionUseCase(pr),
      inject: ['PrismaAdapter'],
    },
  ],
  exports: [PrismaClient, BullModule],
})
export class AppModule {}
