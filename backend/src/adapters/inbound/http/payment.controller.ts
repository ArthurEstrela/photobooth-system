import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { CreatePaymentUseCase } from '../../../core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from '../../../core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from '../../../core/use-cases/expire-payment.usecase';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase
  ) {}

  @Post('create/:boothId')
  async create(@Param('boothId') boothId: string, @Body('amount') amount: number) {
    const payment = await this.createPaymentUseCase.execute(boothId, amount || 10.0);
    
    // Simples agendamento de expiração (idealmente usar BullMQ/Redis Jobs)
    setTimeout(() => {
      this.expirePaymentUseCase.execute(payment.id).catch(console.error);
    }, 2 * 60 * 1000);

    return payment;
  }

  @Post('webhook/mercadopago')
  async webhook(@Body() body: any) {
    if (body.type === 'payment' && body.data?.id) {
      await this.confirmPaymentUseCase.execute(body.data.id.toString());
    }
    return { received: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
