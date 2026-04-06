# Design: Pagamento Completo — PIX + Cartão via Mercado Pago

**Data:** 2026-04-06  
**Status:** Aprovado

---

## Contexto

O sistema é um SaaS para cabines de foto (SparkBooth) que processa pagamentos via Mercado Pago e, após aprovação, pressiona ENTER via RobotJS para iniciar a sessão. Atualmente apenas PIX está implementado. Cartão está ausente e há um bug crítico no cancelamento do job de expiração no webhook.

---

## Objetivos

1. Corrigir o bug de cancelamento do job de expiração pós-confirmação de pagamento.
2. Adicionar suporte a pagamento por cartão via Mercado Pago Checkout Pro (QR Code com link de checkout escaneável pelo celular do cliente).
3. Manter UX: PIX como padrão, botão "Prefiro pagar com Cartão" alterna o modo.
4. Corrigir token hardcoded no frontend.

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Integração cartão | Checkout Pro (Preference API) | Evita formulário na tela pública; cliente paga no próprio celular |
| UX | PIX padrão + toggle para cartão | Mais rápido para a maioria; cartão disponível sem poluir a tela |
| Expiração cartão | 5 minutos | Suficiente para abrir link, preencher e pagar |
| Expiração PIX | 2 minutos (sem mudança) | Mantém comportamento atual |
| Geração QR (cartão) | `qrcode.react` no frontend | Backend retorna URL; frontend gera imagem do QR |

---

## Arquitetura

O sistema segue Arquitetura Hexagonal. Nenhuma regra de negócio entra em adapters; adapters apenas traduzem.

```
Frontend (React/Vite)
  └─ useBoothSocket → WebSocket /booth
  └─ fetch POST /payments/create/:boothId { amount, paymentType }

Backend (NestJS)
  ├─ PaymentController (inbound HTTP)
  │   ├─ POST /payments/create/:boothId
  │   └─ POST /payments/webhook/mercadopago
  ├─ Core
  │   ├─ Payment entity (+ paymentType field)
  │   ├─ CreatePaymentUseCase (aceita paymentType)
  │   ├─ ConfirmPaymentUseCase (retorna internalId)
  │   └─ ExpirePaymentUseCase (sem mudança)
  └─ Adapters outbound
      ├─ MercadoPagoAdapter
      │   ├─ createPixPayment() — existente
      │   └─ createCardCheckoutPayment() — novo (Preference API)
      └─ PrismaAdapter — adicionar paymentType ao schema

Booth Controller (Node.js local)
  └─ Sem mudanças — já reage a PAYMENT_APPROVED
```

---

## Detalhes por Camada

### 1. Prisma Schema

Adicionar campo `paymentType` (enum `PaymentType { PIX CARD }`) ao model `Payment`. Migration gerada via `prisma migrate dev`.

### 2. Payment Entity (`core/entities/payment.entity.ts`)

- Adicionar `PaymentType` enum: `PIX | CARD`
- Adicionar campo `paymentType: PaymentType` ao constructor
- Adicionar campo `checkoutUrl?: string` (só preenchido para CARD)

### 3. PaymentGatewayPort (`core/ports/out/ports.ts`)

Adicionar método:
```typescript
createCardCheckoutPayment(boothId: string, amount: number): Promise<Payment>;
```

### 4. MercadoPagoAdapter

Implementar `createCardCheckoutPayment`:
- Usa `Preference` da SDK do Mercado Pago
- Body: `items`, `external_reference` (UUID interno), `expires: true`, `expiration_date_to` (agora + 5 min), `notification_url` (webhook URL do backend)
- Retorna `Payment` com `checkoutUrl = response.init_point` e `paymentType = CARD`

### 5. CreatePaymentUseCase

- Aceitar `paymentType: 'pix' | 'card'` como parâmetro
- Chamar `paymentGateway.createPixPayment()` ou `paymentGateway.createCardCheckoutPayment()` conforme o tipo
- Delay do job de expiração: `PIX = 2 * 60 * 1000`, `CARD = 5 * 60 * 1000`
- `notifyWaitingPayment` passa `checkoutUrl` e `paymentType` nos dados

### 6. ConfirmPaymentUseCase

- Retornar `{ internalId: string }` após confirmação bem-sucedida
- Permitir que o controller use o ID interno para cancelar o job correto

### 7. PaymentController

**`POST /payments/create/:boothId`:**
- Aceitar `{ amount, paymentType }` no body
- Usar `payment.id` (interno) para `jobId: expire-${payment.id}` — sem mudança, já está correto
- Delay conforme `paymentType`

**`POST /payments/webhook/mercadopago`:**
- Chamar `confirmPaymentUseCase.execute(externalId)` que retorna `{ internalId }`
- Usar `internalId` para `expirationQueue.getJob(`expire-${internalId}`)` — **corrige o bug**

### 8. Frontend — `useBoothSocket.ts`

- `PaymentData` adiciona campos: `checkoutUrl?: string`, `paymentType: 'pix' | 'card'`
- Token: `import.meta.env.VITE_BOOTH_AUTH_TOKEN` (remover hardcode)
- URL backend: `import.meta.env.VITE_BACKEND_URL`

### 9. Frontend — `Payment.tsx`

- Estado local `mode: 'pix' | 'card'`, inicial `'pix'`
- Modo PIX: exibe QR Base64 + timer 2min (comportamento atual)
- Modo CARD: exibe QR gerado via `<QRCodeSVG value={checkoutUrl} />` + timer 5min + texto "Escaneie para pagar com cartão"
- Botão toggle: "Prefiro pagar com Cartão" / "Prefiro pagar com Pix"
- Timer reseta ao trocar de modo

### 10. Frontend — `vite.config.ts` / `.env.example`

Adicionar variáveis:
```
VITE_BACKEND_URL=http://localhost:3000
VITE_BACKEND_WS_URL=http://localhost:3001
VITE_BOOTH_AUTH_TOKEN=mudar_para_um_token_seguro_123
VITE_BOOTH_ID=booth_123
```

---

## Fluxo Completo — Cartão

```
1. Cliente toca "Iniciar Sessão"
2. Frontend POST /payments/create/:boothId { paymentType: 'pix' }
3. Backend cria PIX, agenda job 2min, emite WAITING_PAYMENT via WS
4. Frontend exibe QR PIX + botão "Prefiro cartão"
5. Cliente toca "Prefiro cartão"
6. Frontend POST /payments/switch/:boothId { paymentType: 'card' }
7. Backend: marca o pagamento PIX pendente como cancelado (sem emitir PAYMENT_EXPIRED),
   remove seu job de expiração, cria Preference MP (Checkout Pro),
   agenda novo job de 5min, emite WAITING_PAYMENT com checkoutUrl via WS
8. Frontend exibe QR gerado a partir de checkoutUrl + timer 5min
9. Cliente escaneia com celular → paga com cartão no app/browser do MP
10. MP dispara webhook → ConfirmPaymentUseCase → PAYMENT_APPROVED via WS
11. Booth Controller recebe → RobotJS ENTER → SparkBooth inicia sessão
```

**Endpoint de switch:** `POST /payments/switch/:boothId`  
- Só aceita se booth estiver em `waiting_payment`  
- Cancela o pagamento pending atual (status `cancelled`) silenciosamente  
- Remove o job de expiração atual  
- Cria novo pagamento do tipo solicitado  
- Emite `WAITING_PAYMENT` com os novos dados

---

## Tratamento de Erros

- Se Preference API falhar: lançar erro, booth volta a `idle`, frontend mostra alerta
- Webhook com pagamento não encontrado: log de erro, retornar `{ received: true }` (idempotência)
- Job de expiração não encontrado: ignorar silenciosamente (pode já ter sido removido)

---

## Arquivos Modificados

| Arquivo | Tipo |
|---|---|
| `backend/prisma/schema.prisma` | Modificado |
| `backend/src/core/entities/payment.entity.ts` | Modificado |
| `backend/src/core/ports/out/ports.ts` | Modificado |
| `backend/src/core/use-cases/create-payment.usecase.ts` | Modificado |
| `backend/src/core/use-cases/confirm-payment.usecase.ts` | Modificado |
| `backend/src/core/use-cases/switch-payment.usecase.ts` | Novo |
| `backend/src/adapters/outbound/mercadopago/mercadopago.adapter.ts` | Modificado |
| `backend/src/adapters/inbound/http/payment.controller.ts` | Modificado |
| `frontend/src/hooks/useBoothSocket.ts` | Modificado |
| `frontend/src/components/Payment.tsx` | Modificado |
| `frontend/package.json` | Modificado (adicionar qrcode.react) |
| `frontend/.env.example` | Novo |
| `.env.example` (raiz) | Modificado |

---

## Fora do Escopo

- 3DS / autenticação adicional de cartão (MP Checkout Pro trata internamente)
- Parcelamento (pode ser configurado na preference no futuro)
- Múltiplas cabines simultâneas com cartão (funciona por design, cada booth_id é isolado)
