# Pagamento PIX + Cartão — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a pagamento por cartão (Mercado Pago Checkout Pro via QR Code no celular), corrigir o bug de cancelamento do job de expiração no webhook, e corrigir o token hardcoded no frontend.

**Architecture:** Backend NestJS com Arquitetura Hexagonal — use cases no core, adapters externos. Frontend React/Vite com Socket.IO. MercadoPagoAdapter implementa PIX (Payment API) e Cartão (Preference API). O webhook recebe notificações de ambos; para cartão, usa query param `?paymentId=<internal-uuid>` na notification_url para identificar o pagamento sem chamada extra à API do MP.

**Tech Stack:** NestJS, Prisma (PostgreSQL), BullMQ (Redis), mercadopago SDK v2, React, Vite, qrcode.react, socket.io-client.

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `backend/prisma/schema.prisma` | Já atualizado — só rodar migration |
| `backend/src/core/entities/payment.entity.ts` | Modificar — PaymentType enum, cancel(), checkoutUrl |
| `backend/src/core/ports/out/ports.ts` | Modificar — createCardCheckoutPayment, findPendingByBoothId |
| `backend/src/adapters/outbound/prisma/prisma.adapter.ts` | Modificar — save com paymentType/checkoutUrl, findPendingByBoothId |
| `backend/src/adapters/outbound/mercadopago/mercadopago.adapter.ts` | Modificar — createCardCheckoutPayment (Preference API) |
| `backend/src/core/use-cases/create-payment.usecase.ts` | Modificar — aceitar paymentType, retornar expiresAt |
| `backend/src/core/use-cases/confirm-payment.usecase.ts` | Modificar — aceitar internalId opcional, retornar { internalId } |
| `backend/src/core/use-cases/switch-payment.usecase.ts` | Criar — cancelar PIX, criar novo pagamento |
| `backend/src/adapters/inbound/http/payment.controller.ts` | Modificar — fix webhook bug, paymentType no create, endpoint switch |
| `backend/src/app.module.ts` | Modificar — registrar SwitchPaymentUseCase, webhookUrl no MP |
| `.env.example` | Modificar — WEBHOOK_BASE_URL, CARD_EXPIRATION_MINUTES |
| `frontend/package.json` | Modificar — adicionar qrcode.react |
| `frontend/.env.example` | Criar — variáveis VITE_ |
| `frontend/src/hooks/useBoothSocket.ts` | Modificar — env vars, switchPayment, checkoutUrl/paymentType |
| `frontend/src/components/Payment.tsx` | Modificar — toggle PIX/Cartão, QRCodeSVG |
| `frontend/src/App.tsx` | Modificar — props corretos para Payment, switchPayment |

---

## Task 1: Rodar Migration do Prisma

> Schema já tem PaymentType enum, paymentType e checkoutUrl. Só precisa gerar a migration.

**Files:**
- Modify: `backend/prisma/schema.prisma` (já pronto)

- [ ] **Step 1: Rodar migration**

```bash
cd backend
npx prisma migrate dev --name add_payment_type_and_checkout_url
```

Saída esperada: `Your database is now in sync with your schema.` e geração de arquivo em `prisma/migrations/`.

- [ ] **Step 2: Gerar o Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add backend/prisma/migrations/
git commit -m "feat: prisma migration - paymentType e checkoutUrl"
```

---

## Task 2: Atualizar Payment Entity

**Files:**
- Modify: `backend/src/core/entities/payment.entity.ts`

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/core/entities/payment.entity.ts`:

```typescript
export enum PaymentType {
  PIX = 'pix',
  CARD = 'card',
}

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export class Payment {
  constructor(
    public readonly id: string,
    public readonly boothId: string,
    public readonly amount: number,
    public status: PaymentStatus,
    public readonly paymentType: PaymentType = PaymentType.PIX,
    public readonly externalId: string | null = null,
    public qrCode: string | null = null,
    public qrCodeBase64: string | null = null,
    public checkoutUrl: string | null = null,
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

  cancel() {
    this.status = PaymentStatus.CANCELLED;
    this.updatedAt = new Date();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/core/entities/payment.entity.ts
git commit -m "feat: payment entity - PaymentType, CANCELLED status, cancel(), checkoutUrl"
```

---

## Task 3: Atualizar Ports

**Files:**
- Modify: `backend/src/core/ports/out/ports.ts`

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/core/ports/out/ports.ts`:

```typescript
import { Payment } from '../entities/payment.entity';

export interface PaymentGatewayPort {
  createPixPayment(boothId: string, amount: number): Promise<Payment>;
  createCardCheckoutPayment(boothId: string, amount: number): Promise<Payment>;
}

export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<void>;
  findByExternalId(externalId: string): Promise<Payment | null>;
  findById(id: string): Promise<Payment | null>;
  findPendingByBoothId(boothId: string): Promise<Payment | null>;
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/core/ports/out/ports.ts
git commit -m "feat: ports - createCardCheckoutPayment, findPendingByBoothId"
```

---

## Task 4: Atualizar PrismaAdapter

**Files:**
- Modify: `backend/src/adapters/outbound/prisma/prisma.adapter.ts`

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/adapters/outbound/prisma/prisma.adapter.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/adapters/outbound/prisma/prisma.adapter.ts
git commit -m "feat: prisma adapter - paymentType, checkoutUrl, findPendingByBoothId"
```

---

## Task 5: Atualizar MercadoPagoAdapter

**Files:**
- Modify: `backend/src/adapters/outbound/mercadopago/mercadopago.adapter.ts`

A lógica de cartão usa a `Preference` API do Mercado Pago. A `notification_url` inclui `?paymentId=<uuid-interno>` para que o webhook saiba qual pagamento confirmar sem chamada extra à API do MP.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/adapters/outbound/mercadopago/mercadopago.adapter.ts`:

```typescript
import { PaymentGatewayPort } from '../../../core/ports/out/ports';
import { Payment, PaymentStatus, PaymentType } from '../../../core/entities/payment.entity';
import { MercadoPagoConfig, Payment as MPPayment, Preference } from 'mercadopago';
import { v4 as uuidv4 } from 'uuid';

const CARD_EXPIRATION_MS = 5 * 60 * 1000;

export class MercadoPagoAdapter implements PaymentGatewayPort {
  private readonly client: MPPayment;
  private readonly mpConfig: MercadoPagoConfig;

  constructor(accessToken: string, private readonly webhookBaseUrl: string) {
    this.mpConfig = new MercadoPagoConfig({ accessToken });
    this.client = new MPPayment(this.mpConfig);
  }

  async createPixPayment(boothId: string, amount: number): Promise<Payment> {
    const id = uuidv4();
    const response = await this.client.create({
      body: {
        transaction_amount: amount,
        description: `Photobooth Session - Booth ${boothId}`,
        payment_method_id: 'pix',
        payer: { email: 'booth-customer@example.com' },
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/adapters/outbound/mercadopago/mercadopago.adapter.ts
git commit -m "feat: mercadopago adapter - createCardCheckoutPayment via Preference API"
```

---

## Task 6: Atualizar CreatePaymentUseCase

**Files:**
- Modify: `backend/src/core/use-cases/create-payment.usecase.ts`

O use case passa a aceitar `paymentType` e retorna `expiresAt` junto com o `Payment`, para que o controller consiga agendar o job com o delay correto sem duplicar a regra de negócio.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/core/use-cases/create-payment.usecase.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/core/use-cases/create-payment.usecase.ts
git commit -m "feat: create-payment use case - paymentType param, retorna expiresAt"
```

---

## Task 7: Corrigir ConfirmPaymentUseCase

**Files:**
- Modify: `backend/src/core/use-cases/confirm-payment.usecase.ts`

Aceita `internalId` opcional (para pagamentos de cartão identificados pelo query param) e retorna `{ internalId }` para o controller cancelar o job correto.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/core/use-cases/confirm-payment.usecase.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/core/use-cases/confirm-payment.usecase.ts
git commit -m "fix: confirm-payment use case - retorna internalId, suporte a lookup por id interno"
```

---

## Task 8: Criar SwitchPaymentUseCase

**Files:**
- Create: `backend/src/core/use-cases/switch-payment.usecase.ts`

Cancela o pagamento PIX pendente silenciosamente (sem emitir PAYMENT_EXPIRED) e cria um novo pagamento do tipo solicitado. Retorna `oldPaymentId` para o controller remover o job antigo.

- [ ] **Step 1: Criar o arquivo**

Conteúdo de `backend/src/core/use-cases/switch-payment.usecase.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/core/use-cases/switch-payment.usecase.ts
git commit -m "feat: switch-payment use case - troca tipo de pagamento sem emitir EXPIRED"
```

---

## Task 9: Atualizar PaymentController

**Files:**
- Modify: `backend/src/adapters/inbound/http/payment.controller.ts`

Três mudanças: (1) `create` aceita `paymentType` e usa `expiresAt` retornado pelo use case para o delay; (2) `webhook` usa `internalId` do query param e do retorno do use case — **corrigindo o bug**; (3) novo endpoint `switch`.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/adapters/inbound/http/payment.controller.ts`:

```typescript
import { Controller, Post, Body, Param, Get, Query, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreatePaymentUseCase } from '../../../core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from '../../../core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from '../../../core/use-cases/expire-payment.usecase';
import { SwitchPaymentUseCase } from '../../../core/use-cases/switch-payment.usecase';
import { PaymentType } from '../../../core/entities/payment.entity';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly expirePaymentUseCase: ExpirePaymentUseCase,
    private readonly switchPaymentUseCase: SwitchPaymentUseCase,
    @InjectQueue('payment-expiration') private readonly expirationQueue: Queue,
  ) {}

  @Post('create/:boothId')
  async create(
    @Param('boothId') boothId: string,
    @Body('amount') amount: number,
    @Body('paymentType') paymentType: 'pix' | 'card' = 'pix',
  ) {
    const type = paymentType === 'card' ? PaymentType.CARD : PaymentType.PIX;
    const { payment, expiresAt } = await this.createPaymentUseCase.execute(
      boothId,
      amount || 10.0,
      type,
    );

    const delay = expiresAt.getTime() - Date.now();
    await this.expirationQueue.add(
      'expire-payment',
      { paymentId: payment.id },
      { delay, jobId: `expire-${payment.id}` },
    );

    return payment;
  }

  @Post('switch/:boothId')
  async switch(
    @Param('boothId') boothId: string,
    @Body('paymentType') paymentType: 'pix' | 'card',
  ) {
    const type = paymentType === 'card' ? PaymentType.CARD : PaymentType.PIX;
    const { oldPaymentId, newPayment, expiresAt } = await this.switchPaymentUseCase.execute(
      boothId,
      type,
    );

    // Remove o job de expiração do pagamento anterior
    const oldJob = await this.expirationQueue.getJob(`expire-${oldPaymentId}`);
    if (oldJob) await oldJob.remove();

    // Agenda expiração para o novo pagamento
    const delay = expiresAt.getTime() - Date.now();
    await this.expirationQueue.add(
      'expire-payment',
      { paymentId: newPayment.id },
      { delay, jobId: `expire-${newPayment.id}` },
    );

    return newPayment;
  }

  @Post('webhook/mercadopago')
  async webhook(
    @Body() body: any,
    @Query('paymentId') internalId?: string,
  ) {
    if (body.type === 'payment' && body.data?.id) {
      const externalId = body.data.id.toString();
      // internalId presente = pagamento de Cartão (Checkout Pro)
      // internalId ausente  = pagamento de PIX
      const result = await this.confirmPaymentUseCase.execute(externalId, internalId);

      if (result) {
        // Usa o ID interno correto para cancelar o job de expiração (fix do bug)
        const job = await this.expirationQueue.getJob(`expire-${result.internalId}`);
        if (job) await job.remove();
      }
    }
    return { received: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/adapters/inbound/http/payment.controller.ts
git commit -m "fix: payment controller - webhook bug corrigido, endpoint switch, paymentType no create"
```

---

## Task 10: Atualizar AppModule

**Files:**
- Modify: `backend/src/app.module.ts`

Registra `SwitchPaymentUseCase` no DI e passa `WEBHOOK_BASE_URL` para o `MercadoPagoAdapter`.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `backend/src/app.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { BullModule } from '@nestjs/bullmq';
import { PaymentController } from './adapters/inbound/http/payment.controller';
import { BoothWebsocketGateway } from './adapters/inbound/websocket/booth.gateway';
import { CreatePaymentUseCase } from './core/use-cases/create-payment.usecase';
import { ConfirmPaymentUseCase } from './core/use-cases/confirm-payment.usecase';
import { ExpirePaymentUseCase } from './core/use-cases/expire-payment.usecase';
import { SwitchPaymentUseCase } from './core/use-cases/switch-payment.usecase';
import { MercadoPagoAdapter } from './adapters/outbound/mercadopago/mercadopago.adapter';
import { PrismaAdapter } from './adapters/outbound/prisma/prisma.adapter';
import { PaymentExpirationProcessor } from './infrastructure/queue/payment-expiration.processor';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'payment-expiration' }),
  ],
  controllers: [PaymentController],
  providers: [
    BoothWebsocketGateway,
    PaymentExpirationProcessor,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
    {
      provide: 'PrismaAdapter',
      useFactory: (prisma: PrismaClient) => new PrismaAdapter(prisma),
      inject: [PrismaClient],
    },
    {
      provide: 'MercadoPagoAdapter',
      useFactory: (config: ConfigService) =>
        new MercadoPagoAdapter(
          config.get('MERCADO_PAGO_ACCESS_TOKEN'),
          config.get('WEBHOOK_BASE_URL'),
        ),
      inject: [ConfigService],
    },
    {
      provide: CreatePaymentUseCase,
      useFactory: (mp: MercadoPagoAdapter, pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new CreatePaymentUseCase(mp, pr, pr, ws),
      inject: ['MercadoPagoAdapter', 'PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: ConfirmPaymentUseCase,
      useFactory: (pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new ConfirmPaymentUseCase(pr, pr, ws),
      inject: ['PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: ExpirePaymentUseCase,
      useFactory: (pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new ExpirePaymentUseCase(pr, pr, ws),
      inject: ['PrismaAdapter', BoothWebsocketGateway],
    },
    {
      provide: SwitchPaymentUseCase,
      useFactory: (mp: MercadoPagoAdapter, pr: PrismaAdapter, ws: BoothWebsocketGateway) =>
        new SwitchPaymentUseCase(mp, pr, pr, ws),
      inject: ['MercadoPagoAdapter', 'PrismaAdapter', BoothWebsocketGateway],
    },
  ],
  exports: [PrismaClient, BullModule],
})
export class AppModule {}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat: app module - registra SwitchPaymentUseCase, WEBHOOK_BASE_URL no MP adapter"
```

---

## Task 11: Atualizar .env.example

**Files:**
- Modify: `.env.example` (raiz do projeto)

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `.env.example`:

```env
# API Config
PORT=3000
WS_PORT=3001
NODE_ENV=development

# Database (Prisma)
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=photobooth
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/photobooth?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL="redis://localhost:6379"

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=your_access_token_here
MERCADO_PAGO_PUBLIC_KEY=your_public_key_here

# Webhook — em produção use a URL pública do servidor
# Em desenvolvimento, use ngrok: ngrok http 3000
# Exemplo: WEBHOOK_BASE_URL=https://abc123.ngrok.io
WEBHOOK_BASE_URL=https://your-public-domain.com

# Security
BOOTH_AUTH_TOKEN=mudar_para_um_token_seguro_123

# Business Logic
PIX_EXPIRATION_MINUTES=2
CARD_EXPIRATION_MINUTES=5
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: env.example - WEBHOOK_BASE_URL, CARD_EXPIRATION_MINUTES"
```

---

## Task 12: Frontend — Instalar qrcode.react e criar .env.example

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/.env.example`

- [ ] **Step 1: Instalar qrcode.react**

```bash
cd frontend
npm install qrcode.react
```

Saída esperada: `added X packages`.

- [ ] **Step 2: Criar `frontend/.env.example`**

Conteúdo de `frontend/.env.example`:

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_BACKEND_WS_URL=http://localhost:3000
VITE_BOOTH_AUTH_TOKEN=mudar_para_um_token_seguro_123
VITE_BOOTH_ID=booth_123
```

> **Nota:** Em produção, `VITE_BACKEND_WS_URL` deve apontar para o mesmo servidor do backend. O namespace `/booth` é acrescentado automaticamente pelo hook.

- [ ] **Step 3: Criar `frontend/.env` local (desenvolvimento)**

```bash
cp frontend/.env.example frontend/.env
```

- [ ] **Step 4: Verificar que .env está no .gitignore**

```bash
cat .gitignore | grep -i env
```

Se `*.env` ou `.env` não estiver listado, adicionar ao `.gitignore`:

```
frontend/.env
.env
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/package.json frontend/package-lock.json frontend/.env.example
git commit -m "feat: frontend - adicionar qrcode.react, .env.example"
```

---

## Task 13: Atualizar useBoothSocket.ts

**Files:**
- Modify: `frontend/src/hooks/useBoothSocket.ts`

Remove hardcode de token e URL, adiciona `checkoutUrl` e `paymentType` ao `PaymentData`, e expõe `switchPayment` para o componente trocar o tipo de pagamento.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `frontend/src/hooks/useBoothSocket.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'http://localhost:3000';
const BOOTH_AUTH_TOKEN = import.meta.env.VITE_BOOTH_AUTH_TOKEN || '';
const BOOTH_ID = import.meta.env.VITE_BOOTH_ID || 'booth_123';

export type BoothState = 'idle' | 'waiting_payment' | 'in_session' | 'timeout';

export interface PaymentData {
  qrCode: string | null;
  qrCodeBase64: string | null;
  checkoutUrl: string | null;
  paymentType: 'pix' | 'card';
  amount: number;
  expiresAt: string;
}

export function useBoothSocket(boothId: string = BOOTH_ID) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<BoothState>('idle');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  useEffect(() => {
    const socketInstance = io(`${BACKEND_WS_URL}/booth`, {
      query: { boothId, authToken: BOOTH_AUTH_TOKEN },
    });

    socketInstance.on('connect', () => {
      console.log('[WS] Conectado ao servidor');
    });

    socketInstance.on('WAITING_PAYMENT', (data: PaymentData) => {
      setPaymentData(data);
      setState('waiting_payment');
    });

    socketInstance.on('PAYMENT_APPROVED', () => {
      setState('in_session');
      setPaymentData(null);
      setTimeout(() => setState('idle'), 10000);
    });

    socketInstance.on('PAYMENT_EXPIRED', () => {
      setState('timeout');
      setPaymentData(null);
      setTimeout(() => setState('idle'), 5000);
    });

    setSocket(socketInstance);
    return () => { socketInstance.disconnect(); };
  }, [boothId]);

  const requestPayment = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/payments/create/${boothId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 15.0, paymentType: 'pix' }),
      });
      if (!res.ok) throw new Error('Falha ao criar pagamento');
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar pagamento. Tente novamente.');
      setState('idle');
    }
  }, [boothId]);

  const switchPayment = useCallback(async (paymentType: 'pix' | 'card') => {
    try {
      const res = await fetch(`${BACKEND_URL}/payments/switch/${boothId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentType }),
      });
      if (!res.ok) throw new Error('Falha ao trocar método de pagamento');
    } catch (err) {
      console.error(err);
      alert('Erro ao trocar método de pagamento. Tente novamente.');
    }
  }, [boothId]);

  return { state, paymentData, requestPayment, switchPayment };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useBoothSocket.ts
git commit -m "feat: useBoothSocket - env vars, switchPayment, checkoutUrl/paymentType no PaymentData"
```

---

## Task 14: Atualizar Payment.tsx

**Files:**
- Modify: `frontend/src/components/Payment.tsx`

Adiciona toggle PIX/Cartão. Modo PIX: exibe QR Base64 existente. Modo Cartão: exibe QR gerado via `qrcode.react` a partir da `checkoutUrl`. Timer dinâmico conforme o tipo.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `frontend/src/components/Payment.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PaymentData } from '../hooks/useBoothSocket';

const EXPIRATION_SECONDS: Record<string, number> = {
  pix: 2 * 60,
  card: 5 * 60,
};

interface PaymentProps {
  paymentData: PaymentData;
  onSwitch: (type: 'pix' | 'card') => void;
}

export const Payment: React.FC<PaymentProps> = ({ paymentData, onSwitch }) => {
  const { qrCodeBase64, checkoutUrl, paymentType, expiresAt } = paymentData;
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const expirationTime = new Date(expiresAt).getTime();

    const tick = () => {
      const distance = expirationTime - Date.now();
      if (distance <= 0) {
        setTimeLeft('00:00');
        return;
      }
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isPix = paymentType === 'pix';

  return (
    <div className="container">
      <div className="card pulse">
        {isPix ? (
          <>
            <h2 className="title" style={{ fontSize: '2rem' }}>Pague via Pix</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Leia o QR Code com seu aplicativo de banco</p>
            <div className="qr-code-wrapper">
              {qrCodeBase64 && (
                <img
                  src={`data:image/jpeg;base64,${qrCodeBase64}`}
                  alt="Pix QR Code"
                  className="qr-code-img"
                />
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="title" style={{ fontSize: '2rem' }}>Pague com Cartão</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Escaneie com seu celular e pague pelo app do Mercado Pago</p>
            <div className="qr-code-wrapper">
              {checkoutUrl && (
                <QRCodeSVG
                  value={checkoutUrl}
                  size={220}
                  style={{ display: 'block', margin: '0 auto' }}
                />
              )}
            </div>
          </>
        )}

        <div className="timer">{timeLeft}</div>
        <p style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.85rem' }}>Aguardando confirmação...</p>

        <button
          onClick={() => onSwitch(isPix ? 'card' : 'pix')}
          style={{
            marginTop: '1.5rem',
            background: 'none',
            border: '1px solid #555',
            color: '#aaa',
            padding: '0.5rem 1.2rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          {isPix ? 'Prefiro pagar com Cartão' : 'Prefiro pagar com Pix'}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Payment.tsx
git commit -m "feat: Payment component - toggle PIX/Cartão, QRCodeSVG, timer dinâmico"
```

---

## Task 15: Atualizar App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

Passa `paymentData` completo para `Payment` e fornece o callback `switchPayment`.

- [ ] **Step 1: Substituir o arquivo completo**

Conteúdo final de `frontend/src/App.tsx`:

```typescript
import React from 'react';
import { useBoothSocket } from './hooks/useBoothSocket';
import { Home } from './components/Home';
import { Payment } from './components/Payment';
import { Success } from './components/Success';
import { Timeout } from './components/Timeout';

function App() {
  const { state, paymentData, requestPayment, switchPayment } = useBoothSocket();

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {state === 'idle' && <Home onRequestPayment={requestPayment} />}

      {state === 'waiting_payment' && paymentData && (
        <Payment
          paymentData={paymentData}
          onSwitch={switchPayment}
        />
      )}

      {state === 'in_session' && <Success />}
      {state === 'timeout' && <Timeout />}
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: App - passa paymentData completo e switchPayment para Payment"
```

---

## Task 16: Verificação Final

- [ ] **Step 1: Compilar o backend**

```bash
cd backend
npm run build
```

Saída esperada: sem erros de TypeScript.

- [ ] **Step 2: Subir a infraestrutura**

```bash
cd ..
docker-compose up -d
```

Confirmar que PostgreSQL e Redis estão healthy:

```bash
docker-compose ps
```

- [ ] **Step 3: Iniciar o backend**

```bash
cd backend
npm run start:dev
```

Saída esperada: `Backend running on: http://localhost:3000` e sem erros de conexão.

- [ ] **Step 4: Testar endpoint de criação PIX**

```bash
curl -s -X POST http://localhost:3000/payments/create/booth_123 \
  -H "Content-Type: application/json" \
  -d '{"amount": 15.0, "paymentType": "pix"}' | jq .
```

Resposta esperada: objeto Payment com `paymentType: "pix"` e `qrCodeBase64` preenchido.

- [ ] **Step 5: Testar endpoint de criação Cartão**

Primeiro resetar o estado da cabine (booth fica `waiting_payment` do passo anterior). Para testar, use um booth diferente:

```bash
curl -s -X POST http://localhost:3000/payments/create/booth_456 \
  -H "Content-Type: application/json" \
  -d '{"amount": 15.0, "paymentType": "card"}' | jq .
```

Resposta esperada: objeto Payment com `paymentType: "card"` e `checkoutUrl` preenchido (URL do Mercado Pago).

- [ ] **Step 6: Testar endpoint switch**

```bash
# Criar pagamento PIX primeiro
curl -s -X POST http://localhost:3000/payments/create/booth_789 \
  -H "Content-Type: application/json" \
  -d '{"amount": 15.0, "paymentType": "pix"}' | jq .

# Trocar para cartão
curl -s -X POST http://localhost:3000/payments/switch/booth_789 \
  -H "Content-Type: application/json" \
  -d '{"paymentType": "card"}' | jq .
```

Resposta esperada: novo pagamento com `checkoutUrl` preenchido.

- [ ] **Step 7: Iniciar o frontend**

```bash
cd frontend
npm run dev
```

Acessar `http://localhost:5173`. Fluxo manual:
1. Clicar "Iniciar Sessão" → aparece QR PIX + timer 2min
2. Clicar "Prefiro pagar com Cartão" → aparece QR de cartão + timer 5min
3. Clicar "Prefiro pagar com Pix" → volta para QR PIX

- [ ] **Step 8: Commit final**

```bash
cd ..
git add -A
git commit -m "chore: verificação completa - PIX e Cartão funcionando"
```

---

## Notas de Produção

**WEBHOOK_BASE_URL:** O Mercado Pago precisa de uma URL pública para enviar webhooks. Em desenvolvimento, use [ngrok](https://ngrok.com/):
```bash
ngrok http 3000
# Copie a URL HTTPS e coloque em WEBHOOK_BASE_URL no .env
```

**Sandbox vs Produção:** O `init_point` retornado é a URL de produção. Para testes, use `sandbox_init_point` (alterando `response.init_point` para `response.sandbox_init_point` no adapter enquanto em desenvolvimento).
