// Auth token management utilities

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

/**
 * Save authentication token to localStorage
 */
export function saveAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Get authentication token from localStorage
 */
export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Remove authentication token from localStorage
 */
export function removeAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Decode JWT token (without verification)
 */
export function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
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

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * Get current user from token
 */
export function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  if (isTokenExpired(token)) {
    removeAuthToken();
    return null;
  }

  return decodeToken(token);
}

/**
 * Save user data to localStorage
 */
export function saveUserData(userData) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
}

/**
 * Get user data from localStorage
 */
export function getUserData() {
  const data = localStorage.getItem(AUTH_USER_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Clear all auth data
 */
export function clearAuth() {
  removeAuthToken();
  localStorage.removeItem(AUTH_USER_KEY);
}

/**
 * Login with token
 */
export function login(token) {
  saveAuthToken(token);
  const user = decodeToken(token);
  if (user) {
    saveUserData({
      userId: user.userId,
      platform: user.platform,
      email: user.email,
    });
  }
  return user;
}

/**
 * Logout user
 */
export function logout() {
  clearAuth();
}
