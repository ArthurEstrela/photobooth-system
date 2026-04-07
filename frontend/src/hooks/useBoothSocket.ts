// frontend/src/hooks/useBoothSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3000';
const BACKEND_WS_URL = (import.meta as any).env.VITE_BACKEND_WS_URL || 'http://localhost:3000';
const BOOTH_AUTH_TOKEN = (import.meta as any).env.VITE_BOOTH_AUTH_TOKEN || '';
const BOOTH_ID = (import.meta as any).env.VITE_BOOTH_ID || 'booth_123';
const SESSION_PRICE = parseFloat((import.meta as any).env.VITE_SESSION_PRICE || '15.0');

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
  const [, setSocket] = useState<Socket | null>(null);
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
