import { Payment } from '../entities/payment.entity';

export interface PaymentGatewayPort {
  createPixPayment(boothId: string, amount: number): Promise<Payment>;
}

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;
  findByExternalId(externalId: string): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
}

export interface BoothStateRepositoryPort {
  getState(boothId: string): Promise<import('../entities/booth-state.entity').BoothState>;
  updateStatus(boothId: string, status: import('../entities/booth-state.entity').BoothStatus): Promise<void>;
}

export interface BoothNotifierPort {
  notifyPaymentApproved(boothId: string): Promise<void>;
  notifyPaymentExpired(boothId: string): Promise<void>;
  notifyWaitingPayment(boothId: string, paymentData: any): Promise<void>;
}
