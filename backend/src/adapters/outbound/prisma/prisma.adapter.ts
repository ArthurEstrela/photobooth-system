import { PaymentRepositoryPort, BoothStateRepositoryPort } from '../../../core/ports/out/ports';
import { Payment, PaymentStatus, PaymentType } from '../../../core/entities/payment.entity';
import { BoothState, BoothStatus } from '../../../core/entities/booth-state.entity';
import { PrismaClient } from '@prisma/client';

export class PrismaAdapter implements PaymentRepositoryPort, BoothStateRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async save(payment: Payment): Promise<void> {
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        status: payment.status,
        externalId: payment.externalId,
        updatedAt: payment.updatedAt,
      },
      create: {
        id: payment.id,
        boothId: payment.boothId,
        amount: payment.amount,
        status: payment.status,
        paymentType: payment.paymentType === PaymentType.CARD ? 'CARD' : 'PIX',
        externalId: payment.externalId,
        qrCode: payment.qrCode,
        qrCodeBase64: payment.qrCodeBase64,
        checkoutUrl: payment.checkoutUrl,
      },
    });
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    const p = await this.prisma.payment.findUnique({ where: { externalId } });
    if (!p) return null;
    return this.toEntity(p);
  }

  async findById(id: string): Promise<Payment | null> {
    const p = await this.prisma.payment.findUnique({ where: { id } });
    if (!p) return null;
    return this.toEntity(p);
  }

  async findPendingByBoothId(boothId: string): Promise<Payment | null> {
    const p = await this.prisma.payment.findFirst({
      where: { boothId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!p) return null;
    return this.toEntity(p);
  }

  async getState(boothId: string): Promise<BoothState> {
    let booth = await this.prisma.booth.findUnique({ where: { id: boothId } });
    if (!booth) {
      booth = await this.prisma.booth.create({ data: { id: boothId, status: BoothStatus.IDLE } });
    }
    return new BoothState(booth.id, booth.status as BoothStatus, booth.updatedAt);
  }

  async updateStatus(boothId: string, status: BoothStatus): Promise<void> {
    await this.prisma.booth.update({
      where: { id: boothId },
      data: { status, updatedAt: new Date() },
    });
  }

  private toEntity(p: any): Payment {
    return new Payment(
      p.id,
      p.boothId,
      p.amount,
      p.status as PaymentStatus,
      p.paymentType === 'CARD' ? PaymentType.CARD : PaymentType.PIX,
      p.externalId,
      p.qrCode,
      p.qrCodeBase64,
      p.checkoutUrl,
      p.createdAt,
      p.updatedAt,
    );
  }
}
