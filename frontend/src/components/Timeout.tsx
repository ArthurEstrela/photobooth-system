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
