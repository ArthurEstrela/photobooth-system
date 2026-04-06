import React from 'react';
import { useBoothSocket } from './hooks/useBoothSocket';
import { Home } from './components/Home';
import { Payment } from './components/Payment';
import { Success } from './components/Success';
import { Timeout } from './components/Timeout';

function App() {
  // Simulando que esta cabine tem o ID "booth_123"
  const boothId = 'booth_123';
  const { state, paymentData, requestPayment } = useBoothSocket(boothId);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {state === 'idle' && <Home onRequestPayment={requestPayment} />}
      
      {state === 'waiting_payment' && paymentData && (
        <Payment 
          qrCodeBase64={paymentData.qrCodeBase64} 
          expiresAt={paymentData.expiresAt} 
        />
      )}
      
      {state === 'in_session' && <Success />}
      
      {state === 'timeout' && <Timeout />}
    </div>
  );
}

export default App;
