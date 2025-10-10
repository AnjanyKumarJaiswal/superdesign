/**
 * Token Manager - Handles token expiration and auto re-authentication
 * This module tracks Figma token expiration and triggers re-login when needed
 */
import { useEffect } from 'react';

// Time to check for token expiration (every minute)
const TOKEN_CHECK_INTERVAL = 60 * 1000;

// Figma token expiration (30 minutes)
const FIGMA_TOKEN_EXPIRATION = 30 * 60 * 1000;

// Warning threshold (5 minutes before expiration)
const WARNING_THRESHOLD = 5 * 60 * 1000;

// API URL (get from environment or use default)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class TokenManager {
  constructor() {
    this.tokenTimers = new Map();
    this.tokenStorage = {};
    this.listeners = [];
  }

  /**
   * Initialize the token manager
   */
  initialize() {
    // Start periodic check for token expiration
    setInterval(() => this.checkTokenExpiration(), TOKEN_CHECK_INTERVAL);
    
    // Check for client ID/secret changes
    this.checkCredentialsChanged();
    
    // Try to restore tokens from localStorage
    this.restoreTokens();
  }
  
  /**
   * Check if client credentials have changed and clear tokens if they have
   */
  checkCredentialsChanged() {
    try {
      // Get current client ID hash from localStorage (if any)
      const storedCredentialHash = localStorage.getItem('superdesign_credentials_hash');
      
      // Get current client ID from environment (first part only - for security)
      const currentCredentialPart = import.meta.env.VITE_FIGMA_CLIENT_ID?.substring(0, 8) || '';
      
      // If we have a stored hash and it doesn't match current, clear all tokens
      if (storedCredentialHash && storedCredentialHash !== currentCredentialPart) {
        console.log('Client credentials changed, clearing all tokens');
        this.clearAllTokens();
        
        // Show notification to user
        if (typeof window !== 'undefined') {
          alert('Client credentials have changed. You will need to log in again.');
        }
      }
      
      // Store current hash
      localStorage.setItem('superdesign_credentials_hash', currentCredentialPart);
    } catch (error) {
      console.error('Error checking credentials change:', error);
    }
  }
  
  /**
   * Manually reset all stored tokens and credentials
   * Used when admin changes client ID/secret
   */
  resetStoredCredentials() {
    this.clearAllTokens();
    localStorage.removeItem('superdesign_credentials_hash');
    console.log('Credentials reset completed');
    return true;
  }

  /**
   * Store a token with platform information
   * @param {string} platform - The platform (figma, framer)
   * @param {string} token - The JWT token
   */
  storeToken(platform, token) {
    try {
      // Save to memory
      this.tokenStorage[platform] = {
        token,
        storedAt: Date.now()
      };
      
      // Save to localStorage
      localStorage.setItem(`superdesign_${platform}_token`, token);
      localStorage.setItem(`superdesign_${platform}_timestamp`, Date.now().toString());
      
      console.log(`Stored ${platform} token`);
      
      // Set up expiration timer for Figma
      if (platform === 'figma') {
        this.setupFigmaTokenExpiration();
      }
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  /**
   * Get a stored token
   * @param {string} platform - The platform (figma, framer)
   * @returns {string|null} - The token or null if not found/expired
   */
  getToken(platform) {
    // Check in-memory token first
    if (this.tokenStorage[platform]?.token) {
      // For Figma tokens, check if it's expired (30 minutes)
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
    
    // If not in memory, try localStorage
    return this.restoreToken(platform);
  }
  
  /**
   * Check token status with the server
   * @param {string} platform - The platform (figma, framer)
   * @returns {Promise<Object>} - Token status info
   */
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
      
      // If token is invalid, clear it and notify listeners
      if (!data.valid && data.requiresReauth) {
        console.log(`${platform} token expired according to server`);
        this.clearToken(platform);
        this.notifyTokenExpired(platform);
      }
      
      return data;
    } catch (error) {
      console.error('Error checking token status:', error);
      return { 
        valid: true, // Assume valid if server check fails
        authenticated: true,
        error: error.message
      };
    }
  }

  /**
   * Clear a stored token
   * @param {string} platform - The platform (figma, framer)
   */
  clearToken(platform) {
    // Clear from memory
    delete this.tokenStorage[platform];
    
    // Clear from localStorage
    localStorage.removeItem(`superdesign_${platform}_token`);
    localStorage.removeItem(`superdesign_${platform}_timestamp`);
    
    // Clear any timers
    if (this.tokenTimers.has(platform)) {
      clearTimeout(this.tokenTimers.get(platform));
      this.tokenTimers.delete(platform);
    }
    
    console.log(`Cleared ${platform} token`);
  }
  
  /**
   * Clear all stored tokens
   */
  clearAllTokens() {
    // Clear all platforms
    this.clearToken('figma');
    this.clearToken('framer');
    
    // Clear any other related data
    localStorage.removeItem('superdesign_last_login');
    
    console.log('All tokens cleared');
  }

  /**
   * Set up Figma token expiration timer
   * Figma tokens are set to expire after 30 minutes
   */
  setupFigmaTokenExpiration() {
    // Clear any existing timers
    if (this.tokenTimers.has('figma')) {
      clearTimeout(this.tokenTimers.get('figma'));
    }
    
    // Set new timer
    const timerId = setTimeout(() => {
      console.log('Figma token expiration timer triggered');
      this.clearToken('figma');
      this.notifyTokenExpired('figma');
    }, FIGMA_TOKEN_EXPIRATION);
    
    // Store timer ID
    this.tokenTimers.set('figma', timerId);
    
    console.log(`Figma token will expire in ${FIGMA_TOKEN_EXPIRATION/60000} minutes`);
  }

  /**
   * Check all tokens for expiration
   */
  async checkTokenExpiration() {
    // Check Figma token with server if available
    if (this.tokenStorage.figma) {
      try {
        const status = await this.checkTokenStatus('figma');
        
        if (!status.valid && status.requiresReauth) {
          console.log('Figma token expired during server check');
          this.clearToken('figma');
          this.notifyTokenExpired('figma');
        } else if (status.expiresIn && status.expiresIn < WARNING_THRESHOLD / 1000) {
          // Notify when token is close to expiration (under warning threshold)
          this.notifyTokenExpiringSoon('figma', status.expiresIn);
        }
      } catch (err) {
        // Fallback to local check if server check fails
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

  /**
   * Try to restore tokens from localStorage
   */
  restoreTokens() {
    this.restoreToken('figma');
    this.restoreToken('framer');
  }

  /**
   * Restore a specific token from localStorage
   * @param {string} platform - The platform (figma, framer) 
   * @returns {string|null} - The token or null if not found/expired
   */
  restoreToken(platform) {
    try {
      const token = localStorage.getItem(`superdesign_${platform}_token`);
      const timestamp = localStorage.getItem(`superdesign_${platform}_timestamp`);
      
      if (!token || !timestamp) {
        return null;
      }
      
      const storedAt = parseInt(timestamp, 10);
      
      // For Figma, check if the token is expired (30 minutes)
      if (platform === 'figma') {
        const tokenAge = Date.now() - storedAt;
        if (tokenAge > FIGMA_TOKEN_EXPIRATION) {
          console.log('Figma token expired in localStorage');
          this.clearToken(platform);
          return null;
        }
        
        // Set up expiration timer
        this.setupFigmaTokenExpiration();
      }
      
      // Store in memory
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

  /**
   * Add a listener for token expiration
   * @param {Function} listener - The listener function
   */
  addExpirationListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Remove a token expiration listener
   * @param {Function} listener - The listener function to remove
   */
  removeExpirationListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners about token expiration
   * @param {string} platform - The platform whose token expired
   */
  notifyTokenExpired(platform) {
    this.listeners.forEach(listener => {
      try {
        listener({ platform, type: 'expired' });
      } catch (error) {
        console.error('Error in token expiration listener:', error);
      }
    });
  }
  
  /**
   * Notify all listeners about token expiring soon
   * @param {string} platform - The platform whose token is expiring
   * @param {number} remainingSeconds - Time remaining in seconds
   */
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

// Export singleton instance
export const tokenManager = new TokenManager();

// Initialize token manager
tokenManager.initialize();

/**
 * React hook to handle token expiration
 * @param {Function} onExpiration - Callback when token expires or is about to expire
 * @param {Function} onExpiringSoon - Optional callback for when token is about to expire
 */
export function useTokenExpiration(onExpiration, onExpiringSoon) {
  useEffect(() => {
    // Create a handler function that routes events to appropriate callbacks
    const handleTokenEvent = (event) => {
      if (event.type === 'expired') {
        onExpiration(event.platform);
      } else if (event.type === 'expiring-soon' && onExpiringSoon) {
        onExpiringSoon(event.platform, event.remainingSeconds);
      }
    };
    
    // Add listener when component mounts
    tokenManager.addExpirationListener(handleTokenEvent);
    
    // Remove listener when component unmounts
    return () => tokenManager.removeExpirationListener(handleTokenEvent);
  }, [onExpiration, onExpiringSoon]);
}