import React, { useEffect, useState } from 'react';

interface PaymentProps {
  qrCodeBase64: string;
  expiresAt: string;
}

export const Payment: React.FC<PaymentProps> = ({ qrCodeBase64, expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState<string>('02:00');

  useEffect(() => {
    const expirationTime = new Date(expiresAt).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expirationTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="container">
      <div className="card pulse">
        <h2 className="title" style={{ fontSize: '2rem' }}>Pague via Pix</h2>
        <p className="subtitle" style={{ marginBottom: '1rem' }}>Leia o QR Code abaixo</p>
        
        <div className="qr-code-wrapper">
          <img 
            src={`data:image/jpeg;base64,${qrCodeBase64}`} 
            alt="Pix QR Code" 
            className="qr-code-img" 
          />
        </div>

        <div className="timer">{timeLeft}</div>
        <p style={{ marginTop: '1rem', color: '#888' }}>Aguardando confirmação...</p>
      </div>
    </div>
  );
};
