import { PaymentGatewayPort } from '../../../core/ports/out/ports';
import { Payment, PaymentStatus } from '../../../core/entities/payment.entity';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';

export class MercadoPagoAdapter implements PaymentGatewayPort {
  private client: MPPayment;

  constructor(accessToken: string) {
    const config = new MercadoPagoConfig({ accessToken });
    this.client = new MPPayment(config);
  }

  async createPixPayment(boothId: string, amount: number): Promise<Payment> {
    const id = uuidv4();
    const response = await this.client.create({
      body: {
        transaction_amount: amount,
        description: `Photobooth Session - Booth ${boothId}`,
        payment_method_id: 'pix',
        payer: {
          email: 'booth-customer@example.com', // Placeholder
        },
        external_reference: id,
        installments: 1,
      }
    });

    return new Payment(
      id,
      boothId,
      amount,
      PaymentStatus.PENDING,
      response.id?.toString(),
      response.point_of_interaction?.transaction_data?.qr_code,
      response.point_of_interaction?.transaction_data?.qr_code_base64
    );
  }
}
