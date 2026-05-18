import axios from 'axios';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const SESSION_KEY = 'pmsi_auth';
const APP_SESSION_MS = 8 * 60 * 60 * 1000;
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const DRIVE_ABOUT_URL = 'https://www.googleapis.com/drive/v3/about';
let refreshPromise = null;

function authLog(label, data, { always = false } = {}) {
  if (always || import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true') {
    console.info(`[PMSI Auth] ${label}`, data);
  }
}

function authError(label, data) {
  console.warn(`[PMSI Auth] ${label}`, data);
}

/** GIS TokenResponse → validated OAuth access_token (never id_token). */
export function parseGisTokenResponse(response) {
  authLog('GIS response', {
    keys: response ? Object.keys(response) : [],
    hasAccessToken: Boolean(response?.access_token),
    tokenLengthPresent: Boolean(response?.access_token?.length),
    hasError: Boolean(response?.error),
    error: response?.error || null,
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  const accessToken =
    typeof response?.access_token === 'string' ? response.access_token.trim() : '';

  if (!accessToken) {
    authError('GIS missing access_token', {
      keys: response ? Object.keys(response) : [],
      hasIdToken: Boolean(response?.id_token),
    });
    throw new Error('Google sign-in did not return an access token');
  }

  return {
    accessToken,
    expiresIn: response.expires_in,
  };
}

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

function bearerHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Profile via Drive API — works with drive-only scope.
 * oauth2/v3/userinfo requires profile/email/openid scopes and fails with drive-only tokens.
 */
export async function fetchUserProfile(accessToken) {
  const tokenPresent = Boolean(accessToken);
  const tokenLengthPresent = Boolean(accessToken?.length);

  authLog('fetchUserProfile start', {
    target: DRIVE_ABOUT_URL,
    tokenPresent,
    tokenLengthPresent,
  });

  if (!tokenPresent) {
    throw new Error('Missing access token for profile request');
  }

  try {
    const res = await axios.get(DRIVE_ABOUT_URL, {
      params: { fields: 'user(displayName,emailAddress,photoLink)' },
      headers: bearerHeaders(accessToken),
    });

    const user = res.data?.user;
    authLog('fetchUserProfile success', {
      target: DRIVE_ABOUT_URL,
      status: res.status,
      hasDisplayName: Boolean(user?.displayName),
      hasEmail: Boolean(user?.emailAddress),
    });

    return {
      name: user?.displayName || 'User',
      email: user?.emailAddress || '',
      picture: user?.photoLink || null,
    };
  } catch (driveErr) {
    authError('fetchUserProfile drive/about failed', {
      target: DRIVE_ABOUT_URL,
      status: driveErr.response?.status,
      errorBody: driveErr.response?.data,
      tokenPresent,
      tokenLengthPresent,
    });
    throw driveErr;
  }
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
  const { accessToken, expiresIn } = parseGisTokenResponse(response);
  const tokenExpiresAt = Date.now() + (expiresIn || 3600) * 1000;
  return {
    accessToken,
    tokenExpiresAt,
    expiresAt: sessionExpiresAt(expiresIn),
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
        try {
          const { accessToken, expiresIn } = parseGisTokenResponse(response);
          const updated = {
            ...session,
            accessToken,
            tokenExpiresAt: Date.now() + (expiresIn || 3600) * 1000,
          };
          saveSession(updated);
          authLog('token refresh success', {
            tokenPresent: true,
            tokenLengthPresent: true,
          });
          resolve(accessToken);
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

  authLog('ensureValidAccessToken', {
    tokenPresent: Boolean(session.accessToken),
    tokenLengthPresent: Boolean(session.accessToken?.length),
    expiringSoon: isTokenExpiringSoon(session),
  });

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
      try {
        const { accessToken, expiresIn } = parseGisTokenResponse(response);

        authLog('signIn token parsed', {
          target: 'signInWithGoogle',
          tokenPresent: true,
          tokenLengthPresent: true,
        });

        const user = await fetchUserProfile(accessToken);
        const session = {
          accessToken,
          tokenExpiresAt: Date.now() + (expiresIn || 3600) * 1000,
          expiresAt: sessionExpiresAt(expiresIn),
          user,
        };
        saveSession(session);

        authLog('signIn complete', {
          target: 'sessionStorage',
          tokenPresent: Boolean(session.accessToken),
          userEmailPresent: Boolean(user.email),
        });

        resolve(session);
      } catch (err) {
        authError('signIn failed', {
          message: err.message,
          status: err.response?.status,
          errorBody: err.response?.data,
          failedTarget: err.config?.url || DRIVE_ABOUT_URL,
        });
        reject(err);
      }
    });

    client.requestAccessToken({ prompt: 'select_account' });
  });
}
