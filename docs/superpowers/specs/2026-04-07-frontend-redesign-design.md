# Frontend Redesign — Photobooth Kiosk

**Data:** 2026-04-07  
**Status:** Aprovado

---

## Objetivo

Redesenhar o frontend da cabine de fotos para uso em touchscreen em shopping. Estilo clean/minimalista (branco, tipografia forte), erros tratados com tela dedicada em vez de `alert()`, timer circular animado na tela de pagamento.

---

## Stack

- **Tailwind CSS** + `tailwindcss-animate` plugin
- **Fonte:** Inter (Google Fonts, via `index.html`)
- Sem outras dependências novas além do Tailwind

---

## Arquitetura de Componentes

```
frontend/src/
├── components/
│   ├── Home.tsx           — tela inicial, botão touchscreen-friendly
│   ├── Payment.tsx        — abas PIX/Cartão, QR Code, CircularTimer
│   ├── Success.tsx        — check animado, "Pagamento Aprovado!"
│   ├── Timeout.tsx        — tempo esgotado, botão tentar novamente
│   ├── ErrorScreen.tsx    — tela de erro genérica reutilizável (NOVO)
│   └── CircularTimer.tsx  — SVG circular com countdown (NOVO)
├── hooks/
│   └── useBoothSocket.ts  — remove alert(), expõe estado error: string | null
├── index.css              — apenas diretivas Tailwind (@tailwind base/components/utilities)
└── App.tsx                — adiciona estado de erro, renderiza ErrorScreen quando error != null
```

---

## Paleta Visual

| Token | Valor | Uso |
|---|---|---|
| Fundo | `gray-50` | Background de todas as telas |
| Card | `white` + `shadow-xl` | Container central das telas |
| Título | `gray-900` | Textos principais |
| Subtítulo | `gray-500` | Textos secundários |
| Botão primário | `gray-900` bg / `white` text | Ações principais |
| Botão hover | `gray-700` | Estado hover/active |
| Urgência | `red-500` | Timer nos últimos 30s |
| Sucesso | `green-500` | Tela de sucesso |
| Fonte | Inter (Google Fonts) | Todo o projeto |

Botões touchscreen: altura mínima `h-20` (80px), `text-xl`, `rounded-2xl`.

---

## Telas

### Home
- Logo/nome "Photobooth" centralizado, fonte grande (`text-6xl`)
- Subtítulo discreto
- Botão "Iniciar Sessão" touchscreen-friendly (h-20, w-full máx 400px)

### Payment
- Card com **duas abas no topo**: `PIX` e `Cartão` — clicar na aba chama `onSwitch`
- Centro: QR Code grande (PIX: imagem base64 | Cartão: QRCodeSVG do checkout URL)
- Abaixo do QR: `<CircularTimer expiresAt={...} />`
- Remove o botão "Prefiro pagar com X" — substituído pelas abas

### CircularTimer
- SVG com dois círculos sobrepostos: trilha cinza + arco colorido que diminui
- Número de segundos restantes no centro (`text-3xl font-bold`)
- Props: `expiresAt: string`, `totalSeconds: number`
- Nos últimos 30s: cor muda para `red-500` + `animate-pulse`

### Success
- Ícone de check verde animado (keyframe scale-in via Tailwind)
- Título "Pagamento Aprovado!" em `green-600`
- Subtítulo "Prepare-se para sorrir"
- Sem botão (auto-reset após 10s controlado pelo useBoothSocket)

### Timeout
- Ícone de relógio/X em `red-500`
- Título "Tempo Esgotado"
- Subtítulo "O pagamento não foi confirmado a tempo."
- Botão "Tentar novamente" → chama reset para idle (auto-reset após 5s também)

### ErrorScreen (novo)
- Ícone de alerta em `yellow-500`
- Título: mensagem de erro recebida via prop
- Botão "Tentar novamente" → chama `onRetry` (prop)
- Renderizado pelo `App.tsx` quando `error !== null`

---

## Tratamento de Erros

| Situação | Componente | Ação do botão |
|---|---|---|
| Falha ao criar pagamento (rede/500) | `ErrorScreen` | `setState('idle')` + `setError(null)` |
| Falha ao trocar PIX↔Cartão | `ErrorScreen` | `setError(null)` (fica em waiting_payment) |
| WebSocket desconectado >10s | Banner no topo da tela atual | Automático (reconexão pelo socket) |

**Mudança em `useBoothSocket`:**
- Remove os dois `alert()`
- Adiciona `const [error, setError] = useState<string | null>(null)`
- `requestPayment` e `switchPayment` chamam `setError(mensagem)` em vez de `alert()`
- Retorna `error` e `clearError: () => setError(null)` no objeto de retorno

**Banner de reconexão:**
- `useBoothSocket` expõe `connected: boolean` (true quando socket está conectado)
- `App.tsx` renderiza banner vermelho discreto no topo quando `!connected`
- Banner some automaticamente quando socket reconecta

---

## Mudanças em App.tsx

```tsx
const { state, paymentData, requestPayment, switchPayment, error, clearError, connected } = useBoothSocket();

// Renderiza ErrorScreen sobre tudo quando há erro
if (error) return <ErrorScreen message={error} onRetry={clearError} />;

// Banner de reconexão no topo quando desconectado
{!connected && <ReconnectingBanner />}
```

---

## Instalação do Tailwind

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer tailwindcss-animate
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
content: ["./index.html", "./src/**/*.{ts,tsx}"],
plugins: [require("tailwindcss-animate")]
```

`index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
