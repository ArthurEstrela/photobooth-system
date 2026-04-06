export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

export class Payment {
  constructor(
    public readonly id: string,
    public readonly boothId: string,
    public readonly amount: number,
    public status: PaymentStatus,
    public readonly externalId: string | null = null,
    public qrCode: string | null = null,
    public qrCodeBase64: string | null = null,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  approve() {
    this.status = PaymentStatus.APPROVED;
    this.updatedAt = new Date();
  }

  expire() {
    this.status = PaymentStatus.EXPIRED;
    this.updatedAt = new Date();
  }
}
