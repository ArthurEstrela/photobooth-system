// frontend/src/App.tsx
import { useBoothSocket } from './hooks/useBoothSocket';
import { Home } from './components/Home';
import { Payment } from './components/Payment';
import { Success } from './components/Success';
import { Timeout } from './components/Timeout';
import { ErrorScreen } from './components/ErrorScreen';

function App() {
  const { state, paymentData, requestPayment, switchPayment, error, clearError, connected } = useBoothSocket();

  if (error) {
    return <ErrorScreen message={error} onRetry={clearError} />;
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      {/* Banner de reconexão */}
      {!connected && (
        <div className="w-full bg-red-500 text-white text-center py-2 text-sm font-medium shrink-0">
          Reconectando ao servidor...
        </div>
      )}

      {state === 'idle' && <Home onRequestPayment={requestPayment} />}
      {state === 'waiting_payment' && paymentData && (
        <Payment paymentData={paymentData} onSwitch={switchPayment} />
      )}
      {state === 'in_session' && <Success />}
      {state === 'timeout' && <Timeout />}
    </div>
  );
}

export default App;
