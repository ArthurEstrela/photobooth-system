import { PaymentGatewayPort } from '../../../core/ports/out/ports';
import { Payment, PaymentStatus, PaymentType } from '../../../core/entities/payment.entity';
import { MercadoPagoConfig, Payment as MPPayment, Preference } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';

const CARD_EXPIRATION_MS = 5 * 60 * 1000;

export class MercadoPagoAdapter implements PaymentGatewayPort {
  private readonly client: MPPayment;
  private readonly mpConfig: MercadoPagoConfig;

  constructor(
    accessToken: string,
    private readonly webhookBaseUrl: string,
    testToken: boolean = false,
    private readonly payerEmail: string = 'booth-customer@example.com',
  ) {
    this.mpConfig = new MercadoPagoConfig({
      accessToken,
      options: testToken ? { testToken: true } : undefined,
    });
    this.client = new MPPayment(this.mpConfig);
  }

  async createPixPayment(boothId: string, amount: number): Promise<Payment> {
    const id = uuidv4();
    const response = await this.client.create({
      body: {
        transaction_amount: amount,
        description: `Photobooth Session - Booth ${boothId}`,
        payment_method_id: 'pix',
        payer: { email: this.payerEmail },
        external_reference: id,
        installments: 1,
      },
    });

    return new Payment(
      id,
      boothId,
      amount,
      PaymentStatus.PENDING,
      PaymentType.PIX,
      response.id?.toString(),
      response.point_of_interaction?.transaction_data?.qr_code,
      response.point_of_interaction?.transaction_data?.qr_code_base64,
      null,
    );
  }

  async createCardCheckoutPayment(boothId: string, amount: number): Promise<Payment> {
    const id = uuidv4();
    const preference = new Preference(this.mpConfig);

    const response = await preference.create({
      body: {
        items: [
          {
            id,
            title: `Photobooth Session - Booth ${boothId}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL',
          },
        ],
        external_reference: id,
        expires: true,
        expiration_date_to: new Date(Date.now() + CARD_EXPIRATION_MS).toISOString(),
        notification_url: `${this.webhookBaseUrl}/payments/webhook/mercadopago?paymentId=${id}`,
      },
    });

    return new Payment(
      id,
      boothId,
      amount,
      PaymentStatus.PENDING,
      PaymentType.CARD,
      null,
      null,
      null,
      response.init_point,
    );
  }
}
