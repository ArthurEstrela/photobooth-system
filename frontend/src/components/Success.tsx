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
