import React, { useState } from 'react';
import { tokenManager } from '../utils/tokenManager';
import { saveTokenToEnv } from '../utils/tokenApi';

export default function TokenManagerAdmin() {
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetTokens = () => {
    try {
      if (!tokenManager || typeof tokenManager.resetStoredCredentials !== 'function') {
        throw new Error('Token manager not properly initialized');
      }

      tokenManager.resetStoredCredentials();
      setMessage('All tokens have been cleared from local storage');
      setError('');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Token reset error:', err);
      setError(`Failed to reset tokens: ${err.message || 'Unknown error'}`);
      setMessage('');
    }
  };

  const handleSaveToEnv = async () => {
    if (!apiKey) {
      setError('Admin API key is required');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      if (typeof saveTokenToEnv !== 'function') {
        throw new Error('Token API utilities not properly imported');
      }

      const figmaToken = localStorage.getItem('superdesign_figma_token');
      const framerToken = localStorage.getItem('superdesign_framer_token');

      if (!figmaToken && !framerToken) {
        setError('No tokens found in localStorage');
        setIsLoading(false);
        return;
      }

      let savedCount = 0;

      if (figmaToken) {
        await saveTokenToEnv('figma', figmaToken, null, apiKey);
        savedCount++;
        console.log('Figma token saved to .env');
      }

      if (framerToken) {
        await saveTokenToEnv('framer', framerToken, null, apiKey);
        savedCount++;
        console.log('Framer token saved to .env');
      }

      setMessage(`${savedCount} tokens successfully saved to server .env file`);
    } catch (err) {
      console.error('Token save error:', err);
      setError(`Failed to save tokens: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="token-manager-admin">

      <div className="admin-actions">
        <div className="action-group">
          <h4>Reset Tokens</h4>
          <p>Clear all stored tokens from localStorage. Use this when changing client ID/secret.</p>
          <button
            className="reset-button"
            onClick={handleResetTokens}
          >
            Reset Cached Tokens
          </button>
        </div>

        <div className="action-group">
          <h4>Save Tokens to Server</h4>
          <p>Save current tokens to server .env file (requires admin API key)</p>
          <div className="input-group">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Admin API Key"
              className="api-key-input"
            />
            <button
              className="save-button"
              onClick={handleSaveToEnv}
              disabled={isLoading || !apiKey}
            >
              {isLoading ? 'Saving...' : 'Save to .env'}
            </button>
          </div>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <style jsx>{`
        .token-manager-admin {
          background-color: rgba(15, 23, 42, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 16px;
          max-width: 500px;
          backdrop-filter: blur(10px);
          color: white;
        }
        
        h4 {
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        
        .admin-actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .action-group {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 16px;
        }
        
        .action-group p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 12px;
        }
        
        .input-group {
          display: flex;
          gap: 8px;
        }
        
        .api-key-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background-color: rgba(15, 23, 42, 0.6);
          border-radius: 4px;
          font-size: 14px;
          color: white;
        }
        
        .api-key-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .api-key-input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        
        button {
          padding: 8px 16px;
          border-radius: 4px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Geist Mono', monospace;
        }
        
        .reset-button {
          background-color: rgba(239, 68, 68, 0.8);
          color: white;
        }
        
        .reset-button:hover {
          background-color: rgba(220, 38, 38, 1);
          transform: translateY(-1px);
        }
        
        .save-button {
          background-color: rgba(59, 130, 246, 0.8);
          color: white;
        }
        
        .save-button:hover {
          background-color: rgba(37, 99, 235, 1);
          transform: translateY(-1px);
        }
        
        .save-button:disabled {
          background-color: rgba(148, 163, 184, 0.4);
          cursor: not-allowed;
          transform: none;
        }
        
        .success-message {
          margin-top: 16px;
          padding: 8px 12px;
          background-color: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: rgba(134, 239, 172, 0.9);
          border-radius: 4px;
          font-size: 14px;
        }
        
        .error-message {
          margin-top: 16px;
          padding: 8px 12px;
          background-color: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: rgba(252, 165, 165, 0.9);
          border-radius: 4px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}