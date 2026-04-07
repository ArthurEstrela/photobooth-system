// frontend/src/components/ErrorScreen.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ message, onRetry }) => {
  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-lg flex flex-col items-center gap-8">
        <div className="w-24 h-24 rounded-full bg-yellow-50 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500" />
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
