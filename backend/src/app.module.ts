import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PaymentController } from './adapters/inbound/http/payment.controller';
import { BoothWebsocketGateway } from './adapters/inbound/websocket/booth.gateway';
import { CreatePaymentUseCase } from './core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from './core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from './core/use-cases/expire-payment.usecase';
import { MercadoPagoAdapter } from './adapters/outbound/mercadopago/mercadopago.adapter';
import { PrismaAdapter } from './adapters/outbound/prisma/prisma.adapter';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [PaymentController],
  providers: [
    BoothWebsocketGateway,
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
        new MercadoPagoAdapter(config.get('MERCADO_PAGO_ACCESS_TOKEN')),
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
  ],
  exports: [PrismaClient],
})
export class AppModule {}
