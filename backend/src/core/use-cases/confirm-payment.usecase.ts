import { PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { PaymentStatus } from '../entities/payment.entity';
import { BoothStatus } from '../entities/booth-state.entity';

export class ConfirmPaymentUseCase {
  constructor(
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(
    externalId: string,
    internalId?: string
  ): Promise<{ internalId: string } | null> {
    const payment = internalId
      ? await this.paymentRepository.findById(internalId)
      : await this.paymentRepository.findByExternalId(externalId);

    if (!payment) {
      console.error(`Payment not found. externalId=${externalId} internalId=${internalId ?? 'n/a'}`);
      return null;
    }

    if (payment.status !== PaymentStatus.PENDING) {
      console.warn(`Payment ${payment.id} already processed. Status: ${payment.status}`);
      return { internalId: payment.id };
    }

    const boothState = await this.boothStateRepository.getState(payment.boothId);
    if (!boothState.canApprovePayment()) {
      console.error(`Invalid booth state for approval: ${boothState.status}`);
      return null;
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
      timestamp: new Date().toISOString(),
    }));

    return { internalId: payment.id };
  }
}
