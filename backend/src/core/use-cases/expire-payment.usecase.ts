import { PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { BoothStatus } from '../entities/booth-state.entity';
import { PaymentStatus } from '../entities/payment.entity';

export class ExpirePaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findById(paymentId);
    
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return;
    }

    payment.expire();
    await this.paymentRepository.save(payment);
    
    const boothState = await this.boothStateRepository.getState(payment.boothId);
    if (boothState.status === BoothStatus.WAITING_PAYMENT) {
      await this.boothStateRepository.updateStatus(payment.boothId, BoothStatus.IDLE);
      await this.notifier.notifyPaymentExpired(payment.boothId);
    }

    console.log(JSON.stringify({
      event: 'PAYMENT_EXPIRED',
      boothId: payment.boothId,
      paymentId: payment.id,
      timestamp: new Date().toISOString()
    }));
  }
}
