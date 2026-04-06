export enum BoothStatus {
  IDLE = 'idle',
  WAITING_PAYMENT = 'waiting_payment',
  IN_SESSION = 'in_session'
}

export class BoothState {
  constructor(
    public readonly boothId: string,
    public status: BoothStatus,
    public lastUpdate: Date = new Date()
  ) {}

  canStartPayment(): boolean {
    return this.status === BoothStatus.IDLE;
  }

  canApprovePayment(): boolean {
    return this.status === BoothStatus.WAITING_PAYMENT;
  }
}
