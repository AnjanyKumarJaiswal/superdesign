import { useEffect } from 'react';

const TOKEN_CHECK_INTERVAL = 60 * 1000;

const FIGMA_TOKEN_EXPIRATION = 30 * 60 * 1000;

const WARNING_THRESHOLD = 5 * 60 * 1000;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class TokenManager {
  constructor() {
    this.tokenTimers = new Map();
    this.tokenStorage = {};
    this.listeners = [];
  }

  initialize() {
    setInterval(() => this.checkTokenExpiration(), TOKEN_CHECK_INTERVAL);

    this.checkCredentialsChanged();

    this.restoreTokens();
  }

  checkCredentialsChanged() {
    try {
      const storedCredentialHash = localStorage.getItem('superdesign_credentials_hash');

      const currentCredentialPart = import.meta.env.VITE_FIGMA_CLIENT_ID?.substring(0, 8) || '';

      if (storedCredentialHash && storedCredentialHash !== currentCredentialPart) {
        console.log('Client credentials changed, clearing all tokens');
        this.clearAllTokens();

        if (typeof window !== 'undefined') {
          alert('Client credentials have changed. You will need to log in again.');
        }
      }

      localStorage.setItem('superdesign_credentials_hash', currentCredentialPart);
    } catch (error) {
      console.error('Error checking credentials change:', error);
    }
  }

  resetStoredCredentials() {
    this.clearAllTokens();
    localStorage.removeItem('superdesign_credentials_hash');
    console.log('Credentials reset completed');
    return true;
  }

  storeToken(platform, token) {
    try {
      this.tokenStorage[platform] = {
        token,
        storedAt: Date.now()
      };

      localStorage.setItem(`superdesign_${platform}_token`, token);
      localStorage.setItem(`superdesign_${platform}_timestamp`, Date.now().toString());

      console.log(`Stored ${platform} token`);

      if (platform === 'figma') {
        this.setupFigmaTokenExpiration();
      }
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  getToken(platform) {
    if (this.tokenStorage[platform]?.token) {
      if (platform === 'figma') {
        const tokenAge = Date.now() - (this.tokenStorage[platform].storedAt || 0);
        if (tokenAge > FIGMA_TOKEN_EXPIRATION) {
          console.log('Figma token expired in memory');
          this.clearToken(platform);
          this.notifyTokenExpired(platform);
          return null;
        }
      }
      return this.tokenStorage[platform].token;
    }

    return this.restoreToken(platform);
  }

  async checkTokenStatus(platform) {
    const token = this.getToken(platform);
    if (!token) {
      return {
        valid: false,
        authenticated: false,
        expiresIn: 0,
        requiresReauth: true
      };
    }

    try {
      const response = await fetch(`${API_URL}/auth/token/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.valid && data.requiresReauth) {
        console.log(`${platform} token expired according to server`);
        this.clearToken(platform);
        this.notifyTokenExpired(platform);
      }

      return data;
    } catch (error) {
      console.error('Error checking token status:', error);
      return {
        valid: true,
        authenticated: true,
        error: error.message
      };
    }
  }

  clearToken(platform) {
    delete this.tokenStorage[platform];

    localStorage.removeItem(`superdesign_${platform}_token`);
    localStorage.removeItem(`superdesign_${platform}_timestamp`);

    if (this.tokenTimers.has(platform)) {
      clearTimeout(this.tokenTimers.get(platform));
      this.tokenTimers.delete(platform);
    }

    console.log(`Cleared ${platform} token`);
  }

  clearAllTokens() {
    this.clearToken('figma');
    this.clearToken('framer');

    localStorage.removeItem('superdesign_last_login');

    console.log('All tokens cleared');
  }

  setupFigmaTokenExpiration() {
    if (this.tokenTimers.has('figma')) {
      clearTimeout(this.tokenTimers.get('figma'));
    }

    const timerId = setTimeout(() => {
      console.log('Figma token expiration timer triggered');
      this.clearToken('figma');
      this.notifyTokenExpired('figma');
    }, FIGMA_TOKEN_EXPIRATION);

    this.tokenTimers.set('figma', timerId);

    console.log(`Figma token will expire in ${FIGMA_TOKEN_EXPIRATION / 60000} minutes`);
  }

  async checkTokenExpiration() {
    if (this.tokenStorage.figma) {
      try {
        const status = await this.checkTokenStatus('figma');

        if (!status.valid && status.requiresReauth) {
          console.log('Figma token expired during server check');
          this.clearToken('figma');
          this.notifyTokenExpired('figma');
        } else if (status.expiresIn && status.expiresIn < WARNING_THRESHOLD / 1000) {
          this.notifyTokenExpiringSoon('figma', status.expiresIn);
        }
      } catch (err) {
        console.error('Server token check failed:', err);
        const tokenAge = Date.now() - (this.tokenStorage.figma.storedAt || 0);
        if (tokenAge > FIGMA_TOKEN_EXPIRATION) {
          console.log('Figma token expired during periodic check (local)');
          this.clearToken('figma');
          this.notifyTokenExpired('figma');
        }
      }
    }
  }

  restoreTokens() {
    this.restoreToken('figma');
    this.restoreToken('framer');
  }

  restoreToken(platform) {
    try {
      const token = localStorage.getItem(`superdesign_${platform}_token`);
      const timestamp = localStorage.getItem(`superdesign_${platform}_timestamp`);

      if (!token || !timestamp) {
        return null;
      }

      const storedAt = parseInt(timestamp, 10);

      if (platform === 'figma') {
        const tokenAge = Date.now() - storedAt;
        if (tokenAge > FIGMA_TOKEN_EXPIRATION) {
          console.log('Figma token expired in localStorage');
          this.clearToken(platform);
          return null;
        }

        this.setupFigmaTokenExpiration();
      }

      this.tokenStorage[platform] = {
        token,
        storedAt
      };

      console.log(`Restored ${platform} token from localStorage`);
      return token;
    } catch (error) {
      console.error(`Failed to restore ${platform} token:`, error);
      return null;
    }
  }

  addExpirationListener(listener) {
    this.listeners.push(listener);
  }

  removeExpirationListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  notifyTokenExpired(platform) {
    this.listeners.forEach(listener => {
      try {
        listener({ platform, type: 'expired' });
      } catch (error) {
        console.error('Error in token expiration listener:', error);
      }
    });
  }

  notifyTokenExpiringSoon(platform, remainingSeconds) {
    this.listeners.forEach(listener => {
      try {
        listener({
          platform,
          type: 'expiring-soon',
          remainingSeconds
        });
      } catch (error) {
        console.error('Error in token expiration listener:', error);
      }
    });
  }
}

export const tokenManager = new TokenManager();

tokenManager.initialize();

export function useTokenExpiration(onExpiration, onExpiringSoon) {
  useEffect(() => {
    const handleTokenEvent = (event) => {
      if (event.type === 'expired') {
        onExpiration(event.platform);
      } else if (event.type === 'expiring-soon' && onExpiringSoon) {
        onExpiringSoon(event.platform, event.remainingSeconds);
      }
    };

    tokenManager.addExpirationListener(handleTokenEvent);

    return () => tokenManager.removeExpirationListener(handleTokenEvent);
  }, [onExpiration, onExpiringSoon]);
}