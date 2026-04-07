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
