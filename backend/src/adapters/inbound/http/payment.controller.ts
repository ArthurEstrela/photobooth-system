import { Controller, Post, Body, Param, Get, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { CreatePaymentUseCase } from '../../../core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from '../../../core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from '../../../core/use-cases/expire-payment.usecase';
import { SwitchPaymentUseCase } from '../../../core/use-cases/switch-payment.usecase';
import { CompleteSessionUseCase } from '../../../core/use-cases/complete-session.usecase';
import { PaymentType } from '../../../core/entities/payment.entity';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    private readonly switchPaymentUseCase: SwitchPaymentUseCase,
    private readonly completeSessionUseCase: CompleteSessionUseCase,
    private readonly configService: ConfigService,
    @InjectQueue('payment-expiration') private readonly expirationQueue: Queue,
  ) {}

  @Post('create/:boothId')
  async create(
    @Param('boothId') boothId: string,
    @Body('amount') amount: number,
    @Body('paymentType') paymentType: 'pix' | 'card' = 'pix',
  ) {
    const type = paymentType === 'card' ? PaymentType.CARD : PaymentType.PIX;
    const { payment, expiresAt } = await this.createPaymentUseCase.execute(
      boothId,
      amount || 10.0,
      type,
    );

    const delay = expiresAt.getTime() - Date.now();
    await this.expirationQueue.add(
      'expire-payment',
      { paymentId: payment.id },
      { delay, jobId: `expire-${payment.id}` },
    );

    return payment;
  }

  @Post('switch/:boothId')
  async switch(
    @Param('boothId') boothId: string,
    @Body('paymentType') paymentType: 'pix' | 'card',
  ) {
    const type = paymentType === 'card' ? PaymentType.CARD : PaymentType.PIX;
    const { oldPaymentId, newPayment, expiresAt } = await this.switchPaymentUseCase.execute(
      boothId,
      type,
    );

    // Remove o job de expiração do pagamento anterior
    const oldJob = await this.expirationQueue.getJob(`expire-${oldPaymentId}`);
    if (oldJob) await oldJob.remove();

    // Agenda expiração para o novo pagamento
    const delay = expiresAt.getTime() - Date.now();
    await this.expirationQueue.add(
      'expire-payment',
      { paymentId: newPayment.id },
      { delay, jobId: `expire-${newPayment.id}` },
    );

    return newPayment;
  }

  @Post('webhook/mercadopago')
  async webhook(
    @Body() body: any,
    @Query('paymentId') internalId?: string,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    const webhookSecret = this.configService.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');

    // Valida assinatura HMAC se o segredo estiver configurado
    if (webhookSecret && xSignature && xRequestId && body.data?.id) {
      const isValid = this.verifyWebhookSignature(
        body.data.id.toString(),
        xRequestId,
        xSignature,
        webhookSecret,
      );
      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    if (body.type === 'payment' && body.data?.id) {
      const externalId = body.data.id.toString();
      // internalId presente = pagamento de Cartão (Checkout Pro)
      // internalId ausente  = pagamento de PIX
      const result = await this.confirmPaymentUseCase.execute(externalId, internalId);

      if (result) {
        // Cancela o job de expiração pelo ID interno correto
        const job = await this.expirationQueue.getJob(`expire-${result.internalId}`);
        if (job) await job.remove();
      }
    }
    return { received: true };
  }

  @Post('session-complete/:boothId')
  async sessionComplete(@Param('boothId') boothId: string) {
    await this.completeSessionUseCase.execute(boothId);
    return { success: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // Verificação HMAC conforme especificação do Mercado Pago:
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
  private verifyWebhookSignature(
    dataId: string,
    requestId: string,
    xSignature: string,
    secret: string,
  ): boolean {
    try {
      const parts = xSignature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];
      if (!ts || !v1) return false;

      const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = createHmac('sha256', secret).update(message).digest('hex');

      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(v1, 'hex');

      if (expectedBuf.length !== receivedBuf.length) return false;
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
}
