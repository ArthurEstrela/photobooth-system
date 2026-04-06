import { PaymentGatewayPort, PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { BoothStatus } from '../entities/booth-state.entity';

export class CreatePaymentUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(boothId: string, amount: number): Promise<Payment> {
    const boothState = await this.boothStateRepository.getState(boothId);
    
    if (!boothState.canStartPayment()) {
      throw new Error(`Booth ${boothId} is not IDLE. Current status: ${boothState.status}`);
    }

    const payment = await this.paymentGateway.createPixPayment(boothId, amount);
    
    await this.paymentRepository.save(payment);
    await this.boothStateRepository.updateStatus(boothId, BoothStatus.WAITING_PAYMENT);
    
    await this.notifier.notifyWaitingPayment(boothId, {
      qrCode: payment.qrCode,
      qrCodeBase64: payment.qrCodeBase64,
      amount: payment.amount,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    });

    console.log(JSON.stringify({
      event: 'PAYMENT_CREATED',
      boothId,
      paymentId: payment.id,
      timestamp: new Date().toISOString()
    }));

    return payment;
  }
}
