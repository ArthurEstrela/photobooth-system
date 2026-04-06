import { Controller, Post, Body, Param, Get, Query, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreatePaymentUseCase } from '../../../core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from '../../../core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from '../../../core/use-cases/expire-payment.usecase';
import { SwitchPaymentUseCase } from '../../../core/use-cases/switch-payment.usecase';
import { PaymentType } from '../../../core/entities/payment.entity';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    private readonly switchPaymentUseCase: SwitchPaymentUseCase,
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
  ) {
    if (body.type === 'payment' && body.data?.id) {
      const externalId = body.data.id.toString();
      // internalId presente = pagamento de Cartão (Checkout Pro)
      // internalId ausente  = pagamento de PIX
      const result = await this.confirmPaymentUseCase.execute(externalId, internalId);

      if (result) {
        // Usa o ID interno correto para cancelar o job de expiração (fix do bug)
        const job = await this.expirationQueue.getJob(`expire-${result.internalId}`);
        if (job) await job.remove();
      }
    }
    return { received: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
