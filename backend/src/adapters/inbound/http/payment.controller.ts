import { Controller, Post, Body, Param, Get, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreatePaymentUseCase } from '../../../core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from '../../../core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from '../../../core/use-cases/expire-payment.usecase';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    @InjectQueue('payment-expiration') private readonly expirationQueue: Queue,
  ) {}

  @Post('create/:boothId')
  async create(@Param('boothId') boothId: string, @Body('amount') amount: number) {
    const payment = await this.createPaymentUseCase.execute(boothId, amount || 10.0);
    
    // Agendamento robusto de expiração via BullMQ (Redis)
    await this.expirationQueue.add(
      'expire-payment',
      { paymentId: payment.id },
      { delay: 2 * 60 * 1000, jobId: `expire-${payment.id}` },
    );

    return payment;
  }

  @Post('webhook/mercadopago')
  async webhook(@Body() body: any) {
    if (body.type === 'payment' && body.data?.id) {
      const paymentId = body.data.id.toString();
      await this.confirmPaymentUseCase.execute(paymentId);
      
      // Remover job de expiração se o pagamento for confirmado
      const job = await this.expirationQueue.getJob(`expire-${paymentId}`);
      if (job) await job.remove();
    }
    return { received: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
