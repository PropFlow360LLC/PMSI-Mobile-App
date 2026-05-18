import { useEffect, useState } from 'react';
import { loadGoogleScript, signInWithGoogle } from '../services/googleAuth';

export default function Login({ onLogin, onNotification }) {
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    loadGoogleScript()
      .then(() => setReady(true))
      .catch(() => onNotification?.('Failed to load Google sign-in', 'error'));
  }, [onNotification]);

  const handleSignIn = async () => {
    if (!ready || signingIn) return;
    setSigningIn(true);
    try {
      const session = await signInWithGoogle();
      await onLogin(session);
    } catch (err) {
      console.error('Sign in error:', err);
      onNotification?.('Sign in failed. Please try again.', 'error');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#000',
      padding: '20px',
      paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
      paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '28px', width: '100%', maxWidth: '340px' }}>
        <img
          src="/branding/pmsi-logo.png"
          alt="Property Maintenance Services Indy, LLC"
          style={{
            width: '100%',
            maxWidth: '320px',
            height: 'auto',
            display: 'block',
            margin: '0 auto 12px',
          }}
        />
        <div style={{ fontSize: '14px', color: '#7aaad8' }}>Field photo capture &amp; upload</div>
      </div>

      <button
        onClick={handleSignIn}
        disabled={!ready || signingIn}
        style={{
          width: '100%',
          maxWidth: '320px',
          padding: '14px',
          background: '#008800',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: ready && !signingIn ? 'pointer' : 'not-allowed',
          opacity: ready && !signingIn ? 1 : 0.6,
          marginBottom: '20px',
        }}
      >
        {signingIn ? 'Signing in…' : '🔑 Sign in with Google'}
      </button>

      <div style={{ fontSize: '12px', color: '#3a5a70', maxWidth: '280px' }}>
        You'll sign in with your Google account. Photos upload directly to the shared PMSI folder.
      </div>
    </div>
  );
}
