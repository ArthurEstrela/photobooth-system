import React from 'react';
import { useBoothSocket } from './hooks/useBoothSocket';
import { Home } from './components/Home';
import { Payment } from './components/Payment';
import { Success } from './components/Success';
import { Timeout } from './components/Timeout';

function App() {
  const { state, paymentData, requestPayment, switchPayment } = useBoothSocket();

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {state === 'idle' && <Home onRequestPayment={requestPayment} />}

      {state === 'waiting_payment' && paymentData && (
        <Payment
          paymentData={paymentData}
          onSwitch={switchPayment}
        />
      )}

      {state === 'in_session' && <Success />}
      {state === 'timeout' && <Timeout />}
    </div>
  );
}

export default App;
