import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PasswordRecoveryGate } from './components/PasswordRecoveryGate';
import { supabase } from './lib/supabase';
import './index.css';

function Root() {
  const [passwordRecovery, setPasswordRecovery] = React.useState(() => {
    const hash = window.location.hash;
    const query = new URLSearchParams(window.location.search);
    return hash.includes('type=recovery') || query.get('type') === 'recovery';
  });

  React.useEffect(() => {
    const handleAuthEvent = (event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
    };

    const { data } = supabase.auth.onAuthStateChange(handleAuthEvent);
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <>
      <App />
      {passwordRecovery && <PasswordRecoveryGate />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
