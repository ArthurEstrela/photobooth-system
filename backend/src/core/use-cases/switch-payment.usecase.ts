import { PaymentGatewayPort, PaymentRepositoryPort, BoothStateRepositoryPort, BoothNotifierPort } from '../ports/out/ports';
import { Payment, PaymentType } from '../entities/payment.entity';
import { BoothStatus } from '../entities/booth-state.entity';

const EXPIRATION_MS: Record<PaymentType, number> = {
  [PaymentType.PIX]: 2 * 60 * 1000,
  [PaymentType.CARD]: 5 * 60 * 1000,
};

export class SwitchPaymentUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly paymentRepository: PaymentRepositoryPort,
    private readonly boothStateRepository: BoothStateRepositoryPort,
    private readonly notifier: BoothNotifierPort
  ) {}

  async execute(
    boothId: string,
    paymentType: PaymentType
  ): Promise<{ oldPaymentId: string; newPayment: Payment; expiresAt: Date }> {
    const boothState = await this.boothStateRepository.getState(boothId);
    if (boothState.status !== BoothStatus.WAITING_PAYMENT) {
      throw new Error(`Booth ${boothId} is not in WAITING_PAYMENT state.`);
    }

    const pending = await this.paymentRepository.findPendingByBoothId(boothId);
    if (!pending) {
      throw new Error(`No pending payment found for booth ${boothId}`);
    }

    // Cancela silenciosamente sem emitir PAYMENT_EXPIRED
    pending.cancel();
    await this.paymentRepository.save(pending);

    // Cria novo pagamento do tipo solicitado
    const newPayment =
      paymentType === PaymentType.CARD
        ? await this.paymentGateway.createCardCheckoutPayment(boothId, pending.amount)
        : await this.paymentGateway.createPixPayment(boothId, pending.amount);

    await this.paymentRepository.save(newPayment);

    const expiresAt = new Date(Date.now() + EXPIRATION_MS[paymentType]);

    await this.notifier.notifyWaitingPayment(boothId, {
      qrCode: newPayment.qrCode,
      qrCodeBase64: newPayment.qrCodeBase64,
      checkoutUrl: newPayment.checkoutUrl,
      paymentType: newPayment.paymentType,
      amount: newPayment.amount,
      expiresAt,
    });

    console.log(JSON.stringify({
      event: 'PAYMENT_SWITCHED',
      boothId,
      oldPaymentId: pending.id,
      newPaymentId: newPayment.id,
      paymentType,
      timestamp: new Date().toISOString(),
    }));

    return { oldPaymentId: pending.id, newPayment, expiresAt };
  }
}
