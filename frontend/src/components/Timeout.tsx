import React from 'react';

export const Timeout: React.FC = () => {
  return (
    <div className="container">
      <h2 className="title" style={{ color: '#FF3B30' }}>Tempo Esgotado</h2>
      <p className="subtitle">O pagamento não foi confirmado a tempo.</p>
    </div>
  );
};
