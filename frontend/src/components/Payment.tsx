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
