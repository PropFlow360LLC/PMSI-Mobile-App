import { useEffect } from 'react';

export default function Login({ onLogin }) {
  useEffect(() => {
    // Load Google API
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/platform.js';
    script.onload = () => {
      window.gapi.load('auth2', () => {
        window.gapi.auth2.init({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive'
        });
      });
    };
    document.head.appendChild(script);
  }, []);

  const handleSignIn = () => {
    if (window.gapi && window.gapi.auth2) {
      window.gapi.auth2.getAuthInstance().signIn().then(() => {
        const profile = window.gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
        onLogin(profile);
      });
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
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        🔑 Sign in with Google
      </button>

      <div style={{ fontSize: '12px', color: '#3a5a70', maxWidth: '280px' }}>
        You'll sign in with your Google account. Photos upload directly to the shared PMSI folder.
      </div>
    </div>
  );
}
