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
