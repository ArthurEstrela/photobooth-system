import { PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { BoothStatus } from '../entities/booth-state.entity';

export class ConfirmPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(externalId: string): Promise<void> {
    const payment = await this.paymentRepository.findByExternalId(externalId);
    
    if (!payment) {
      console.error(`Payment not found for externalId: ${externalId}`);
      return;
    }

    if (payment.status !== 'pending') {
      console.warn(`Payment ${payment.id} already processed. Status: ${payment.status}`);
      return;
    }

    const boothState = await this.boothStateRepository.getState(payment.boothId);
    if (!boothState.canApprovePayment()) {
      console.error(`Invalid booth state for approval: ${boothState.status}`);
      return;
    }

    payment.approve();
    await this.paymentRepository.save(payment);
    await this.boothStateRepository.updateStatus(payment.boothId, BoothStatus.IN_SESSION);
    
    await this.notifier.notifyPaymentApproved(payment.boothId);

    console.log(JSON.stringify({
      event: 'PAYMENT_CONFIRMED',
      boothId: payment.boothId,
      paymentId: payment.id,
      externalId,
      timestamp: new Date().toISOString()
    }));
  }
}
