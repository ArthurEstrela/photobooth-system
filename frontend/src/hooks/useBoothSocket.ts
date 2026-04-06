import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type BoothState = 'idle' | 'waiting_payment' | 'in_session' | 'timeout';

interface PaymentData {
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  expiresAt: string;
}

export function useBoothSocket(boothId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<BoothState>('idle');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  useEffect(() => {
    // Em produção, a URL deve vir de import.meta.env
    const socketInstance = io('http://localhost:3001/booth', {
      query: { boothId, authToken: 'mudar_para_um_token_seguro_123' } // Usando o token do .env
    });

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socketInstance.on('WAITING_PAYMENT', (data: PaymentData) => {
      setPaymentData(data);
      setState('waiting_payment');
    });

    socketInstance.on('PAYMENT_APPROVED', () => {
      setState('in_session');
      setPaymentData(null);
      
      // Auto-return to idle after 10 seconds (simulate photo session finish)
      setTimeout(() => setState('idle'), 10000);
    });

    socketInstance.on('PAYMENT_EXPIRED', () => {
      setState('timeout');
      setPaymentData(null);
      
      // Auto-return to idle after showing timeout message
      setTimeout(() => setState('idle'), 5000);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [boothId]);

  const requestPayment = useCallback(async () => {
    try {
      // Cria a intenção de pagamento no backend
      const res = await fetch(`http://localhost:3000/payments/create/${boothId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 15.0 })
      });
      if (!res.ok) throw new Error('Failed to create payment');
      
      // Nota: o backend disparará WAITING_PAYMENT via websocket
    } catch (err) {
      console.error(err);
      // Fallback em caso de erro da API
      alert('Erro ao iniciar pagamento. Tente novamente.');
      setState('idle');
    }
  }, [boothId]);

  return { state, paymentData, requestPayment };
}
