import React from 'react';

interface HomeProps {
  onRequestPayment: () => void;
}

export const Home: React.FC<HomeProps> = ({ onRequestPayment }) => {
  return (
    <div className="container">
      <h1 className="title">Tire Suas Fotos!</h1>
      <p className="subtitle">Toque no botão abaixo para começar a sessão.</p>
      
      <button className="btn-primary" onClick={onRequestPayment}>
        Iniciar Sessão
      </button>
    </div>
  );
};
