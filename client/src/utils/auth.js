const AUTH_TOKEN_KEY = 'auth_token_v2';
const AUTH_USER_KEY = 'auth_user_v2';
const SESSION_ID_KEY = 'session_id';
const OAUTH_CLIENT_HASH_KEY = 'superdesign_credentials_hash';

const SESSION_ID = generateRandomId();

function generateRandomId() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function clearLegacyStorage() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');

  const storedSessionId = localStorage.getItem(SESSION_ID_KEY);
  if (storedSessionId && storedSessionId !== SESSION_ID) {
    console.log('New session detected, clearing cached auth data');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  localStorage.setItem(SESSION_ID_KEY, SESSION_ID);
}

clearLegacyStorage();

export function saveAuthToken(token) {
  if (!token) return;

  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    console.log('Auth token saved');
  } catch (error) {
    console.error('Failed to save auth token:', error);
  }
}

export function getAuthToken() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

export function removeAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    console.log('Auth token removed');
  } catch (error) {
    console.error('Failed to remove auth token:', error);
  }
}

export function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;

  if (isTokenExpired(token)) {
    console.log('Token expired, clearing auth data');
    clearAuth();
    return false;
  }

  return true;
}

export function decodeToken(token) {
  if (!token) return null;

  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

export function isTokenExpired(token) {
  if (!token) return true;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < (currentTime - 10);
}

export function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  if (isTokenExpired(token)) {
    console.log('Token expired, removing');
    removeAuthToken();
    return null;
  }

  return decodeToken(token);
}

export function saveUserData(userData) {
  if (!userData) return;

  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to save user data:', error);
  }
}

export function getUserData() {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
}

export function clearAuth() {
  try {
    removeAuthToken();
    localStorage.removeItem(AUTH_USER_KEY);
    console.log('Auth data cleared');
  } catch (error) {
    console.error('Failed to clear auth data:', error);
  }
}

export function cleanOAuthCache() {
  try {
    localStorage.removeItem(OAUTH_CLIENT_HASH_KEY);
    localStorage.removeItem('superdesign_figma_token');
    localStorage.removeItem('superdesign_figma_timestamp');
    localStorage.removeItem('superdesign_framer_token');
    localStorage.removeItem('superdesign_framer_timestamp');
    localStorage.removeItem('superdesign_last_login');
    localStorage.removeItem('figma_access_token');

    const localStorageKeys = Object.keys(localStorage);
    for (const key of localStorageKeys) {
      if (key.includes('figma') ||
        key.includes('framer') ||
        key.includes('oauth') ||
        key.includes('token') ||
        key.includes('auth')) {
        localStorage.removeItem(key);
      }
    }

    console.log('OAuth cache cleaned successfully');
    return true;
  } catch (error) {
    console.error('Error cleaning OAuth cache:', error);
    return false;
  }
}

export function login(token) {
  if (!token) {
    console.error('Cannot login: No token provided');
    return null;
  }

  clearAuth();

  saveAuthToken(token);

  const user = decodeToken(token);
  if (user) {
    if (user.accessToken) {
      localStorage.setItem('figma_access_token', user.accessToken);
      console.log('Figma access token stored separately');
    }

    saveUserData({
      userId: user.userId,
      platform: user.platform,
      email: user.email,
      accessToken: user.accessToken,
      authTime: Date.now(),
      tokenExpiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null
    });
    console.log(`Logged in as ${user.userId} via ${user.platform}`);
  } else {
    console.error('Failed to decode user from token');
  }

  return user;
}

export function logout() {
  console.log('Logging out user');
  clearAuth();

  window.location.href = '/';
}
