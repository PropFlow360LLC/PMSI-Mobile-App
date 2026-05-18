import axios from 'axios';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const SESSION_KEY = 'pmsi_auth';
const APP_SESSION_MS = 8 * 60 * 60 * 1000;
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let refreshPromise = null;

export function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export function createTokenClient(onTokenResponse) {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: onTokenResponse,
  });
}

export async function fetchUserProfile(accessToken) {
  const res = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return {
    name: res.data.name,
    email: res.data.email,
    picture: res.data.picture,
  };
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.accessToken || Date.now() >= session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function revokeAccessToken(accessToken) {
  if (!accessToken || !window.google?.accounts?.oauth2?.revoke) return;
  window.google.accounts.oauth2.revoke(accessToken, () => {});
}

export function sessionExpiresAt(expiresInSeconds) {
  const tokenExpiry = Date.now() + (expiresInSeconds || 3600) * 1000;
  const appExpiry = Date.now() + APP_SESSION_MS;
  return Math.min(tokenExpiry, appExpiry);
}

export function buildSessionFromTokenResponse(response, user) {
  const tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
  return {
    accessToken: response.access_token,
    tokenExpiresAt,
    expiresAt: sessionExpiresAt(response.expires_in),
    user,
  };
}

function isTokenExpiringSoon(session) {
  if (!session.tokenExpiresAt) return true;
  return Date.now() >= session.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS;
}

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise(async (resolve, reject) => {
    try {
      await loadGoogleScript();
      const session = loadSession();
      if (!session) {
        reject(new Error('Not signed in'));
        return;
      }

      const client = createTokenClient(async (response) => {
        refreshPromise = null;
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          const updated = {
            ...session,
            accessToken: response.access_token,
            tokenExpiresAt: Date.now() + (response.expires_in || 3600) * 1000,
          };
          saveSession(updated);
          resolve(updated.accessToken);
        } catch (err) {
          reject(err);
        }
      });

      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      refreshPromise = null;
      reject(err);
    }
  });

  return refreshPromise;
}

export async function ensureValidAccessToken(onSessionUpdate) {
  const session = loadSession();
  if (!session) throw new Error('Not signed in');

  if (!isTokenExpiringSoon(session)) {
    return session.accessToken;
  }

  const accessToken = await refreshAccessToken();
  onSessionUpdate?.(loadSession());
  return accessToken;
}

export async function signInWithGoogle() {
  await loadGoogleScript();

  return new Promise((resolve, reject) => {
    const client = createTokenClient(async (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      try {
        const user = await fetchUserProfile(response.access_token);
        const session = buildSessionFromTokenResponse(response, user);
        saveSession(session);
        resolve(session);
      } catch (err) {
        reject(err);
      }
    });

    client.requestAccessToken({ prompt: 'select_account' });
  });
}
