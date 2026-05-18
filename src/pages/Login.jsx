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
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>📱</div>
        <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>PMSI Mobile App</div>
        <div style={{ fontSize: '14px', color: '#7aaad8' }}>Property Maintenance Services Indy</div>
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
          marginBottom: '20px'
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
