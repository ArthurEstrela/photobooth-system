import React from 'react';

export const Success: React.FC = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="loader" style={{ borderColor: 'rgba(255,43,94,0.1)', borderTopColor: 'var(--primary)' }}></div>
        <h2 className="title" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>Pagamento Aprovado!</h2>
        <p className="subtitle">Prepare-se para sorrir, a sessão vai começar...</p>
      </div>
    </div>
  );
};
