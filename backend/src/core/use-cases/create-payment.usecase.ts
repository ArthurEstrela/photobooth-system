import { PaymentGatewayPort, PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { Payment, PaymentType } from '../entities/payment.entity';
import { BoothStatus } from '../entities/booth-state.entity';

const EXPIRATION_MS: Record<PaymentType, number> = {
  [PaymentType.PIX]: 2 * 60 * 1000,
  [PaymentType.CARD]: 5 * 60 * 1000,
};

export class CreatePaymentUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(
    boothId: string,
    amount: number,
    paymentType: PaymentType = PaymentType.PIX
  ): Promise<{ payment: Payment; expiresAt: Date }> {
    const boothState = await this.boothStateRepository.getState(boothId);

    if (!boothState.canStartPayment()) {
      throw new Error(`Booth ${boothId} is not IDLE. Current status: ${boothState.status}`);
    }

    const payment =
      paymentType === PaymentType.CARD
        ? await this.paymentGateway.createCardCheckoutPayment(boothId, amount)
        : await this.paymentGateway.createPixPayment(boothId, amount);

    await this.paymentRepository.save(payment);
    await this.boothStateRepository.updateStatus(boothId, BoothStatus.WAITING_PAYMENT);

    const expiresAt = new Date(Date.now() + EXPIRATION_MS[paymentType]);

    await this.notifier.notifyWaitingPayment(boothId, {
      qrCode: payment.qrCode,
      qrCodeBase64: payment.qrCodeBase64,
      checkoutUrl: payment.checkoutUrl,
      paymentType: payment.paymentType,
      amount: payment.amount,
      expiresAt,
    });

    console.log(JSON.stringify({
      event: 'PAYMENT_CREATED',
      boothId,
      paymentId: payment.id,
      paymentType,
      timestamp: new Date().toISOString(),
    }));

    return { payment, expiresAt };
  }
}
