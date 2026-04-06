import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ExpirePaymentUseCase } from '../../core/use-cases/expire-payment.usecase';
import { Logger } from '@nestjs/common';

@Processor('payment-expiration')
export class PaymentExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentExpirationProcessor.name);

  constructor(private readonly expirePaymentUseCase: ExpirePaymentUseCase) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { paymentId } = job.data;
    this.logger.log(`Processing expiration for payment: ${paymentId}`);
    
    try {
      await this.expirePaymentUseCase.execute(paymentId);
    } catch (error) {
      this.logger.error(`Failed to expire payment ${paymentId}: ${error.message}`);
    }
  }
}
