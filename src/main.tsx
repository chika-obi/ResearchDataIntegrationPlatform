import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PasswordRecoveryGate } from './components/PasswordRecoveryGate';
import { supabase } from './lib/supabase';
import './index.css';

function isRecoveryUrl() {
  const hash = window.location.hash;
  const query = new URLSearchParams(window.location.search);

  return (
    window.location.pathname === '/reset-password' ||
    hash.includes('type=recovery') ||
    hash.includes('access_token=') ||
    query.get('type') === 'recovery' ||
    query.has('code')
  );
}

function Root() {
  const [passwordRecovery, setPasswordRecovery] = React.useState(isRecoveryUrl);

  React.useEffect(() => {
    const handleAuthEvent = (event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
    };

    const { data } = supabase.auth.onAuthStateChange(handleAuthEvent);

    // Re-check after Supabase has had a chance to process the recovery URL.
    if (isRecoveryUrl()) {
      setPasswordRecovery(true);
    }

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
