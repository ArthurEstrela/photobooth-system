# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o frontend da cabine de fotos com Tailwind CSS, estilo clean/minimalista, timer circular animado, tela de erro dedicada e sem `alert()`.

**Architecture:** Tailwind CSS substitui todo CSS inline e o `index.css`. Dois componentes novos (`CircularTimer`, `ErrorScreen`) são adicionados. `useBoothSocket` passa a expor `error`, `clearError` e `connected`. `App.tsx` renderiza `ErrorScreen` quando há erro e um banner de reconexão quando desconectado.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, tailwindcss-animate, lucide-react (já instalado), qrcode.react (já instalado)

---

## File Map

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `frontend/tailwind.config.js` | Configuração do Tailwind |
| Criar | `frontend/postcss.config.js` | PostCSS para Tailwind |
| Modificar | `frontend/index.html` | Adicionar fonte Inter |
| Substituir | `frontend/src/index.css` | Apenas diretivas @tailwind |
| Modificar | `frontend/src/hooks/useBoothSocket.ts` | Remover alert(), expor error/clearError/connected |
| Modificar | `frontend/src/App.tsx` | Renderizar ErrorScreen e banner de reconexão |
| Criar | `frontend/src/components/CircularTimer.tsx` | SVG circular com countdown |
| Criar | `frontend/src/components/ErrorScreen.tsx` | Tela de erro com botão retry |
| Substituir | `frontend/src/components/Home.tsx` | Redesign |
| Substituir | `frontend/src/components/Payment.tsx` | Redesign com abas PIX/Cartão |
| Substituir | `frontend/src/components/Success.tsx` | Redesign |
| Substituir | `frontend/src/components/Timeout.tsx` | Redesign |

---

## Task 1: Instalar e configurar Tailwind CSS

**Files:**
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Instalar dependências**

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer tailwindcss-animate
```

- [ ] **Step 2: Criar `tailwind.config.js`**

```js
// frontend/tailwind.config.js
import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [tailwindAnimate],
};
```

- [ ] **Step 3: Criar `postcss.config.js`**

```js
// frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Substituir `src/index.css`**

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    user-select: none;
    -webkit-touch-callout: none;
    box-sizing: border-box;
  }

  body {
    font-family: 'Inter', sans-serif;
    overflow: hidden; /* sem scroll no kiosk */
  }
}
```

- [ ] **Step 5: Adicionar fonte Inter no `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Photobooth Kiosk</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/src/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Verificar que o Tailwind está funcionando**

```bash
cd frontend
npm run dev
```

Abre `http://localhost:5173` — a tela deve carregar (mesmo sem redesign ainda). Se aparecer erro de import do `tailwindcss-animate`, confirma que o `node_modules` foi atualizado.

- [ ] **Step 7: Commit**

```bash
git add frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/src/index.css frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): instalar e configurar Tailwind CSS + fonte Inter"
```

---

## Task 2: Atualizar `useBoothSocket` — remover alert(), expor error/clearError/connected

**Files:**
- Modify: `frontend/src/hooks/useBoothSocket.ts`

- [ ] **Step 1: Substituir o arquivo completo**

```ts
// frontend/src/hooks/useBoothSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'http://localhost:3000';
const BOOTH_AUTH_TOKEN = import.meta.env.VITE_BOOTH_AUTH_TOKEN || '';
const BOOTH_ID = import.meta.env.VITE_BOOTH_ID || 'booth_123';
const SESSION_PRICE = parseFloat(import.meta.env.VITE_SESSION_PRICE || '15.0');

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
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const socketInstance = io(`${BACKEND_WS_URL}/booth`, {
      query: { boothId, authToken: BOOTH_AUTH_TOKEN },
    });

    socketInstance.on('connect', () => {
      console.log('[WS] Conectado ao servidor');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('WAITING_PAYMENT', (data: PaymentData) => {
      setPaymentData(data);
      setState('waiting_payment');
    });

    socketInstance.on('PAYMENT_APPROVED', () => {
      setState('in_session');
      setPaymentData(null);
      setTimeout(async () => {
        try {
          await fetch(`${BACKEND_URL}/payments/session-complete/${boothId}`, {
            method: 'POST',
          });
        } catch (err) {
          console.error('[WS] Falha ao resetar estado da cabine:', err);
        }
        setState('idle');
      }, 10000);
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
        body: JSON.stringify({ amount: SESSION_PRICE, paymentType: 'pix' }),
      });
      if (!res.ok) throw new Error('Falha ao criar pagamento');
    } catch (err) {
      console.error(err);
      setError('Não foi possível iniciar o pagamento. Verifique a conexão e tente novamente.');
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
      setError('Não foi possível trocar o método de pagamento. Tente novamente.');
    }
  }, [boothId]);

  const clearError = useCallback(() => setError(null), []);

  return { state, paymentData, requestPayment, switchPayment, error, clearError, connected };
}
```

- [ ] **Step 2: Verificar que o app ainda compila**

```bash
npm run dev
```

Esperado: sem erros de TypeScript no terminal. A tela deve continuar funcionando (ainda usando CSS antigo nos componentes).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useBoothSocket.ts
git commit -m "feat(frontend): remover alert(), expor error/clearError/connected no useBoothSocket"
```

---

## Task 3: Criar `CircularTimer`

**Files:**
- Create: `frontend/src/components/CircularTimer.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/components/CircularTimer.tsx
import React, { useEffect, useState } from 'react';

interface CircularTimerProps {
  expiresAt: string;
  totalSeconds: number;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({ expiresAt, totalSeconds }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const expirationTime = new Date(expiresAt).getTime();

    const tick = () => {
      const distance = expirationTime - Date.now();
      if (distance <= 0) {
        setSecondsLeft(0);
        return;
      }
      setSecondsLeft(Math.ceil(distance / 1000));
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);
  const isUrgent = secondsLeft <= 30;
  const strokeColor = isUrgent ? '#ef4444' : '#111827'; // red-500 : gray-900

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className={`relative inline-flex items-center justify-center ${isUrgent ? 'animate-pulse' : ''}`}>
      <svg width="128" height="128" viewBox="0 0 128 128">
        {/* Trilha cinza */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        {/* Arco de progresso */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute text-2xl font-bold tabular-nums"
        style={{ color: strokeColor }}
      >
        {timeDisplay}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verificar compilação**

```bash
npm run dev
```

Esperado: sem erros de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CircularTimer.tsx
git commit -m "feat(frontend): criar CircularTimer com SVG e urgência nos últimos 30s"
```

---

## Task 4: Criar `ErrorScreen`

**Files:**
- Create: `frontend/src/components/ErrorScreen.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// frontend/src/components/ErrorScreen.tsx
import React from 'react';
import { TriangleAlert } from 'lucide-react';

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ message, onRetry }) => {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-lg flex flex-col items-center gap-8">
        <div className="w-24 h-24 rounded-full bg-yellow-50 flex items-center justify-center">
          <TriangleAlert className="w-12 h-12 text-yellow-500" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-black text-gray-900">Algo deu errado</h2>
          <p className="text-lg text-gray-500">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="w-full h-20 bg-gray-900 hover:bg-gray-700 active:scale-95 text-white text-xl font-semibold rounded-2xl transition-all duration-150 select-none"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ErrorScreen.tsx
git commit -m "feat(frontend): criar ErrorScreen com botão retry"
```

---

## Task 5: Atualizar `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Substituir o arquivo**

```tsx
// frontend/src/App.tsx
import React from 'react';
import { useBoothSocket } from './hooks/useBoothSocket';
import { Home } from './components/Home';
import { Payment } from './components/Payment';
import { Success } from './components/Success';
import { Timeout } from './components/Timeout';
import { ErrorScreen } from './components/ErrorScreen';

function App() {
  const { state, paymentData, requestPayment, switchPayment, error, clearError, connected } = useBoothSocket();

  if (error) {
    return <ErrorScreen message={error} onRetry={clearError} />;
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      {/* Banner de reconexão */}
      {!connected && (
        <div className="w-full bg-red-500 text-white text-center py-2 text-sm font-medium shrink-0">
          Reconectando ao servidor...
        </div>
      )}

      {state === 'idle' && <Home onRequestPayment={requestPayment} />}
      {state === 'waiting_payment' && paymentData && (
        <Payment paymentData={paymentData} onSwitch={switchPayment} />
      )}
      {state === 'in_session' && <Success />}
      {state === 'timeout' && <Timeout />}
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Verificar compilação**

```bash
npm run dev
```

Esperado: sem erros de TypeScript. O app deve continuar renderizando (componentes ainda têm CSS antigo).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): App.tsx - ErrorScreen, banner de reconexão, connected state"
```

---

## Task 6: Redesign `Home`

**Files:**
- Modify: `frontend/src/components/Home.tsx`

- [ ] **Step 1: Substituir o componente**

```tsx
// frontend/src/components/Home.tsx
import React from 'react';
import { Camera } from 'lucide-react';

interface HomeProps {
  onRequestPayment: () => void;
}

export const Home: React.FC<HomeProps> = ({ onRequestPayment }) => {
  return (
    <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-lg flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <Camera className="w-10 h-10 text-gray-900" />
          </div>
          <h1 className="text-6xl font-black text-gray-900 tracking-tight">Photobooth</h1>
          <p className="text-xl text-gray-500 text-center">Tire fotos incríveis em segundos</p>
        </div>
        <button
          onClick={onRequestPayment}
          className="w-full h-20 bg-gray-900 hover:bg-gray-700 active:scale-95 text-white text-2xl font-semibold rounded-2xl transition-all duration-150 select-none"
        >
          Iniciar Sessão
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar visualmente**

Com `npm run dev` rodando, abre `http://localhost:5173`. Deve aparecer card branco centralizado com ícone de câmera, título "Photobooth" e botão grande.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Home.tsx
git commit -m "feat(frontend): redesign Home - Tailwind, clean/minimalista"
```

---

## Task 7: Redesign `Payment`

**Files:**
- Modify: `frontend/src/components/Payment.tsx`

- [ ] **Step 1: Substituir o componente**

```tsx
// frontend/src/components/Payment.tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CircularTimer } from './CircularTimer';
import { PaymentData } from '../hooks/useBoothSocket';

const TOTAL_SECONDS: Record<string, number> = {
  pix: 2 * 60,
  card: 5 * 60,
};

interface PaymentProps {
  paymentData: PaymentData;
  onSwitch: (type: 'pix' | 'card') => void;
}

export const Payment: React.FC<PaymentProps> = ({ paymentData, onSwitch }) => {
  const { qrCodeBase64, checkoutUrl, paymentType, expiresAt } = paymentData;
  const isPix = paymentType === 'pix';

  return (
    <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Abas PIX / Cartão */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => !isPix && onSwitch('pix')}
            className={`flex-1 py-5 text-lg font-semibold transition-colors duration-150 select-none ${
              isPix
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            PIX
          </button>
          <button
            onClick={() => isPix && onSwitch('card')}
            className={`flex-1 py-5 text-lg font-semibold transition-colors duration-150 select-none ${
              !isPix
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Cartão
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-10 flex flex-col items-center gap-8">
          <p className="text-gray-500 text-center text-lg">
            {isPix
              ? 'Escaneie o QR Code com o app do seu banco'
              : 'Escaneie com seu celular e pague pelo Mercado Pago'}
          </p>

          {/* QR Code */}
          <div className="p-4 bg-gray-50 rounded-2xl">
            {isPix && qrCodeBase64 && (
              <img
                src={`data:image/jpeg;base64,${qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-56 h-56"
              />
            )}
            {!isPix && checkoutUrl && (
              <QRCodeSVG value={checkoutUrl} size={224} />
            )}
          </div>

          {/* Timer circular */}
          <CircularTimer
            expiresAt={expiresAt}
            totalSeconds={TOTAL_SECONDS[paymentType] ?? 120}
          />

          <p className="text-gray-400 text-sm">Aguardando confirmação do pagamento...</p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar visualmente**

Clica "Iniciar Sessão" no frontend → tela de payment deve aparecer com abas PIX/Cartão no topo e timer circular.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Payment.tsx
git commit -m "feat(frontend): redesign Payment - abas PIX/Cartão, CircularTimer"
```

---

## Task 8: Redesign `Success`

**Files:**
- Modify: `frontend/src/components/Success.tsx`

- [ ] **Step 1: Substituir o componente**

```tsx
// frontend/src/components/Success.tsx
import React from 'react';
import { CheckCircle } from 'lucide-react';

export const Success: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-lg flex flex-col items-center gap-8">
        <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle className="w-14 h-14 text-green-500" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-4xl font-black text-green-600">Pagamento Aprovado!</h2>
          <p className="text-xl text-gray-500">Prepare-se para sorrir ✦</p>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Success.tsx
git commit -m "feat(frontend): redesign Success - check animado verde"
```

---

## Task 9: Redesign `Timeout`

**Files:**
- Modify: `frontend/src/components/Timeout.tsx`

- [ ] **Step 1: Substituir o componente**

```tsx
// frontend/src/components/Timeout.tsx
import React from 'react';
import { Clock } from 'lucide-react';

export const Timeout: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-lg flex flex-col items-center gap-8">
        <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
          <Clock className="w-12 h-12 text-red-500" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-4xl font-black text-gray-900">Tempo Esgotado</h2>
          <p className="text-xl text-gray-500">O pagamento não foi confirmado a tempo.</p>
        </div>
        <p className="text-gray-400 text-sm">Voltando automaticamente...</p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar o fluxo completo**

Com todos os componentes redesenhados:
1. Abre `http://localhost:5173` — tela Home com card branco
2. Clica "Iniciar Sessão" — tela Payment com abas e timer circular
3. Simula webhook de aprovação via PowerShell:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/payments/webhook/mercadopago" -Method POST -ContentType "application/json" -Body '{"type":"payment","data":{"id":"ID_AQUI"}}'
   ```
4. Tela Success aparece com check verde animado
5. Após 10s volta para Home
6. Para testar Timeout: aguarda o timer zerar (2 min no PIX) ou desconecta o Redis para forçar expiração

- [ ] **Step 3: Commit final**

```bash
git add frontend/src/components/Timeout.tsx
git commit -m "feat(frontend): redesign Timeout - clock vermelho"
```
